import { useState, useEffect } from "react";
import { api } from "../lib/api";

// --- Types ---

type LogEntry =
  | { kind: "system"; ts: string; message: string }
  | { kind: "stderr"; ts: string; message: string }
  | { kind: "assistant"; ts: string; text: string }
  | { kind: "thinking"; ts: string; text: string }
  | { kind: "tool_call"; ts: string; name: string; input: string; callId: string }
  | { kind: "tool_result"; ts: string; callId: string; output: string; exitCode?: number; isError: boolean }
  | { kind: "turn_summary"; ts: string; inputTokens: number; outputTokens: number; cost?: number; durationMs?: number }
  | { kind: "raw"; ts: string; stream: string; text: string };

// --- Parse logic ---

/**
 * Parse a single inner codex stdout line (already split from chunk).
 * Mirrors the logic in packages/adapters/codex-local/src/ui/parse-stdout.ts
 */
function parseCodexLine(line: string, ts: string, entries: LogEntry[]): void {
  if (!line) return;
  let inner: Record<string, unknown>;
  try {
    inner = JSON.parse(line) as Record<string, unknown>;
  } catch {
    // Not JSON — skip silently (partial buffers, noise)
    return;
  }

  const type = inner.type as string | undefined;

  // item.started → tool_call (create the call record)
  if (type === "item.started") {
    const item = inner.item as Record<string, unknown> | undefined;
    if (!item) return;

    if (item.type === "command_execution") {
      const cmd = typeof item.command === "string" ? item.command : JSON.stringify(item.command ?? "");
      const callId = (item.id as string) ?? "";
      entries.push({
        kind: "tool_call", ts,
        name: "command_execution",
        input: JSON.stringify({ command: cmd }),
        callId,
      });
    } else if (item.type === "function_call" || item.type === "tool_call") {
      const name = (item.name as string) ?? (item.function as string) ?? "unknown";
      const params = item.parameters ?? item.arguments ?? item.input ?? {};
      entries.push({
        kind: "tool_call", ts,
        name,
        input: typeof params === "string" ? params : JSON.stringify(params),
        callId: (item.id as string) ?? "",
      });
    }
    return;
  }

  // item.completed → tool_result / assistant message
  if (type === "item.completed") {
    const item = inner.item as Record<string, unknown> | undefined;
    if (!item) return;

    if (item.type === "agent_message" || item.type === "message") {
      const text = typeof item.text === "string" ? item.text :
        ((item.content ?? []) as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      if (text) {
        const last = entries.at(-1);
        if (last?.kind === "assistant") {
          last.text += text; // accumulate streaming deltas
        } else {
          entries.push({ kind: "assistant", ts, text });
        }
      }
      return;
    }

    if (item.type === "command_execution") {
      // aggregated_output (not output) — trim trailing whitespace per baton's parser
      const rawOut = item.aggregated_output ?? item.output ?? "";
      const output = (typeof rawOut === "string" ? rawOut : JSON.stringify(rawOut)).replace(/\s+$/, "");
      const exitCode = item.exit_code as number | undefined;
      const callId = (item.id as string) ?? "";
      entries.push({ kind: "tool_result", ts, callId, output, exitCode, isError: exitCode !== undefined && exitCode !== 0 });
      return;
    }

    if (item.type === "function_call" || item.type === "tool_call") {
      // If item.started was emitted, this is the result; otherwise create both
      const callId = (item.id as string) ?? "";
      const hasCall = entries.some((e) => e.kind === "tool_call" && e.callId === callId);
      if (!hasCall) {
        const name = (item.name as string) ?? "unknown";
        const params = item.parameters ?? item.arguments ?? item.input ?? {};
        entries.push({
          kind: "tool_call", ts, name,
          input: typeof params === "string" ? params : JSON.stringify(params),
          callId,
        });
      }
      const rawOut = item.output ?? item.result ?? "";
      const output = typeof rawOut === "string" ? rawOut : JSON.stringify(rawOut);
      const exitCode = item.exit_code as number | undefined;
      entries.push({ kind: "tool_result", ts, callId, output, exitCode, isError: !!(item.is_error) || (exitCode !== undefined && exitCode !== 0) });
      return;
    }

    if (item.type === "reasoning" || item.type === "thinking") {
      const text = typeof item.text === "string" ? item.text : (item.summary as string) ?? "";
      if (text) entries.push({ kind: "thinking", ts, text });
      return;
    }

    if (item.type === "file_change") {
      const files = (item.files as string[]) ?? [];
      if (files.length) entries.push({ kind: "system", ts, message: `[file_change] ${files.join(", ")}` });
      return;
    }

    return;
  }

  // turn.completed → token/cost summary (rich data available)
  if (type === "turn.completed") {
    const usage = inner.usage as Record<string, unknown> | undefined;
    const inputTokens = (usage?.input_tokens as number) ?? (inner.input_tokens as number) ?? 0;
    const outputTokens = (usage?.output_tokens as number) ?? (inner.output_tokens as number) ?? 0;
    const cost = (inner.cost as number) ?? undefined;
    const durationMs = (inner.duration_ms as number) ?? undefined;
    if (inputTokens || outputTokens) {
      entries.push({ kind: "turn_summary", ts, inputTokens, outputTokens, cost, durationMs });
    }
    return;
  }

  // Anthropic streaming format — content_block_start (tool_use)
  if (type === "content_block_start") {
    const cb = inner.content_block as Record<string, unknown> | undefined;
    if (cb?.type === "tool_use") {
      entries.push({
        kind: "tool_call", ts,
        name: (cb.name as string) ?? "unknown",
        input: JSON.stringify(cb.input ?? {}),
        callId: (cb.id as string) ?? "",
      });
    }
    return;
  }

  // Anthropic streaming format — content_block_delta (text streaming)
  if (type === "content_block_delta") {
    const delta = inner.delta as Record<string, unknown> | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      const last = entries.at(-1);
      if (last?.kind === "assistant") {
        last.text += delta.text;
      } else {
        entries.push({ kind: "assistant", ts, text: delta.text });
      }
    }
    return;
  }

  // Anthropic: full message with content array
  if (type === "message" && inner.role === "assistant") {
    const textContent = ((inner.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    if (textContent) entries.push({ kind: "assistant", ts, text: textContent });
    return;
  }

  // Gemini / OpenAI tool_call type
  if (type === "tool_call") {
    const params = inner.parameters ?? inner.arguments ?? inner.input ?? {};
    entries.push({
      kind: "tool_call", ts,
      name: (inner.name as string) ?? "unknown",
      input: typeof params === "string" ? params : JSON.stringify(params),
      callId: (inner.call_id as string) ?? (inner.id as string) ?? "",
    });
    return;
  }

  if (type === "tool_result") {
    const rawOutput = inner.output ?? inner.result ?? "";
    const output = typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput);
    const exitCode = inner.exit_code as number | undefined;
    entries.push({
      kind: "tool_result", ts,
      callId: (inner.call_id as string) ?? "",
      output, exitCode,
      isError: (exitCode !== undefined && exitCode !== 0) || !!(inner.is_error),
    });
    return;
  }

  // Silently skip known noise events
  const noiseTypes = new Set([
    "turn.started", "thread.started", "thread.completed",
    "message_start", "message_stop", "message_delta",
    "content_block_stop", "ping", "item.error",
  ]);
  if (type && noiseTypes.has(type)) return;
}

function parseLog(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  // Outer lines are always complete JSONL (atomic writes per baton's logging)
  const outerLines = content.split("\n");
  let stdoutBuffer = "";

  for (const outerLine of outerLines) {
    const trimmed = outerLine.trim();
    if (!trimmed) continue;

    let outer: { ts?: string; stream?: string; chunk?: string };
    try {
      outer = JSON.parse(trimmed) as { ts?: string; stream?: string; chunk?: string };
    } catch {
      continue;
    }

    const ts = outer.ts ?? new Date().toISOString();
    const stream = outer.stream ?? "stdout";
    const chunk = outer.chunk ?? "";

    if (stream === "stderr" || stream === "system") {
      if (!chunk.trim()) continue;
      if (chunk.trim().startsWith("[baton]") || stream === "system") {
        entries.push({ kind: "system", ts, message: chunk.trim() });
      } else {
        entries.push({ kind: "stderr", ts, message: chunk.trim() });
      }
      continue;
    }

    // stdout: chunk can contain multiple \n-separated JSON events.
    // Maintain a buffer for partial lines (identical to buildTranscript in baton).
    const combined = stdoutBuffer + chunk;
    const innerLines = combined.split(/\r?\n/);
    stdoutBuffer = innerLines.pop() ?? "";

    for (const innerLine of innerLines) {
      parseCodexLine(innerLine.trim(), ts, entries);
    }
  }

  // Flush remaining buffer
  if (stdoutBuffer.trim()) {
    parseCodexLine(stdoutBuffer.trim(), new Date().toISOString(), entries);
  }

  return entries;
}

// --- Helpers ---

function Timestamp({ ts }: { ts: string }) {
  const t = new Date(ts).toLocaleTimeString("ko-KR", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return <span className="text-[11px] text-gray-400 font-mono shrink-0 w-16">{t}</span>;
}

function ExpandButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] text-gray-400 hover:text-gray-600 font-mono px-1.5 py-0.5 rounded hover:bg-gray-100 transition-colors shrink-0"
    >
      {expanded ? "▼ 접기" : "▶ 펼치기"}
    </button>
  );
}

const TOOL_ICONS: Record<string, string> = {
  command_execution: "⚡", bash: "⚡",
  str_replace_based_edit_tool: "✏️", str_replace_editor: "✏️", edit_file: "✏️",
  read_file: "📖", write_file: "📝", computer: "🖥️",
};

function getInputSummary(_name: string, input: string): string {
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    if (typeof parsed.command === "string") return parsed.command;
    if (typeof parsed.path === "string") return parsed.path;
    if (typeof parsed.file_path === "string") return parsed.file_path;
    if (typeof parsed.old_string === "string") return parsed.old_string.slice(0, 200);
    return input;
  } catch {
    return input;
  }
}

// --- TraceEntry ---

function TraceEntry({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (entry.kind === "system") {
    return (
      <div className="flex items-start gap-3 py-1">
        <Timestamp ts={entry.ts} />
        <span className="text-xs text-blue-600 font-mono leading-relaxed">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "stderr") {
    return (
      <div className="flex items-start gap-3 py-1">
        <Timestamp ts={entry.ts} />
        <span className="text-xs text-red-600 font-mono leading-relaxed">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <div className="my-2 border-l-4 border-violet-400 bg-violet-50 rounded-r-xl p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Timestamp ts={entry.ts} />
          <span className="text-xs font-bold text-violet-700 uppercase tracking-tight">🤖 에이전트</span>
        </div>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === "thinking") {
    return (
      <div className="my-1 border-l-4 border-amber-300 bg-amber-50 rounded-r-xl p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Timestamp ts={entry.ts} />
          <span className="text-xs font-bold text-amber-700 uppercase tracking-tight">💭 추론</span>
          <ExpandButton expanded={expanded} onClick={() => setExpanded((v) => !v)} />
        </div>
        {expanded && (
          <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap font-mono">{entry.text}</p>
        )}
      </div>
    );
  }

  if (entry.kind === "turn_summary") {
    const costStr = entry.cost != null ? ` · $${entry.cost.toFixed(4)}` : "";
    const durStr = entry.durationMs != null ? ` · ${(entry.durationMs / 1000).toFixed(1)}s` : "";
    return (
      <div className="flex items-center gap-3 py-1.5 px-3 bg-gray-50 rounded-xl border border-gray-100 my-1">
        <Timestamp ts={entry.ts} />
        <span className="text-sm">📊</span>
        <span className="text-xs font-mono text-gray-600">
          in: <strong>{entry.inputTokens.toLocaleString()}</strong>
          &nbsp;·&nbsp;
          out: <strong>{entry.outputTokens.toLocaleString()}</strong>
          {costStr && <span className="text-gray-400">{costStr}</span>}
          {durStr && <span className="text-gray-400">{durStr}</span>}
        </span>
      </div>
    );
  }

  if (entry.kind === "tool_call") {
    const icon = TOOL_ICONS[entry.name] ?? "🔧";
    const summary = getInputSummary(entry.name, entry.input);

    // Only show expand when there are multiple meaningful fields beyond the summary
    let parsedInput: Record<string, unknown> | null = null;
    let fullInput = entry.input;
    try {
      parsedInput = JSON.parse(entry.input) as Record<string, unknown>;
      fullInput = JSON.stringify(parsedInput, null, 2);
    } catch { /* keep as-is */ }

    // Has extra fields worth expanding? (more than just command/path/file_path)
    const extraFields = parsedInput
      ? Object.keys(parsedInput).filter((k) => !["command", "path", "file_path"].includes(k))
      : [];
    const hasExtra = extraFields.length > 0;

    return (
      <div className="my-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Header row */}
        <div className="flex items-start gap-2 px-3 py-2.5 bg-white">
          <Timestamp ts={entry.ts} />
          <span className="text-sm shrink-0 mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{entry.name}</span>
              {hasExtra && (
                <span className="text-[10px] text-gray-400 font-mono">
                  +{extraFields.join(", ")}
                </span>
              )}
            </div>
            {/* Full command — wrapped, not truncated */}
            <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words leading-relaxed bg-gray-50 rounded-lg p-2 mt-1">
              {summary}
            </pre>
          </div>
          {hasExtra && (
            <ExpandButton expanded={expanded} onClick={() => setExpanded((v) => !v)} />
          )}
        </div>
        {/* Expanded extra fields */}
        {expanded && hasExtra && (
          <div className="border-t border-gray-100 bg-slate-950 p-3">
            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {fullInput}
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (entry.kind === "tool_result") {
    const isErr = entry.isError || (entry.exitCode !== undefined && entry.exitCode !== 0);
    const isEmpty = !entry.output.trim();
    const exitLabel = entry.exitCode !== undefined ? `exit:${entry.exitCode}` : "";

    // Empty successful result — compact
    if (!isErr && isEmpty) {
      return (
        <div className="flex items-center gap-3 py-1 pl-1">
          <Timestamp ts={entry.ts} />
          <span className="text-sm">✅</span>
          {exitLabel && <span className="text-xs font-bold text-emerald-700 font-mono">{exitLabel}</span>}
          <span className="text-xs text-gray-400 italic">출력 없음</span>
        </div>
      );
    }

    const isLong = entry.output.length > 800;
    return (
      <div className={`my-1 border rounded-xl overflow-hidden shadow-sm ${isErr ? "border-red-200" : "border-gray-200"}`}>
        <div className={`flex items-start gap-2 px-3 py-2.5 ${isErr ? "bg-red-50" : "bg-white"}`}>
          <Timestamp ts={entry.ts} />
          <span className="text-sm shrink-0">{isErr ? "❌" : "✅"}</span>
          <div className="flex-1 min-w-0">
            {exitLabel && (
              <span className={`text-xs font-black font-mono ${isErr ? "text-red-700" : "text-emerald-700"}`}>
                {exitLabel}
              </span>
            )}
            {entry.output.trim() && (
              <pre className={`text-xs font-mono whitespace-pre-wrap break-words leading-relaxed mt-1 p-2 rounded-lg overflow-y-auto ${
                isErr ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-700"
              } ${isLong && !expanded ? "max-h-48" : ""}`}>
                {entry.output}
              </pre>
            )}
          </div>
          {isLong && (
            <ExpandButton expanded={expanded} onClick={() => setExpanded((v) => !v)} />
          )}
        </div>
      </div>
    );
  }

  if (entry.kind === "raw" && entry.text.trim()) {
    return (
      <div className="flex items-start gap-3 py-1">
        <Timestamp ts={entry.ts} />
        <span className="text-xs text-gray-500 font-mono leading-relaxed whitespace-pre-wrap break-words">{entry.text}</span>
      </div>
    );
  }

  return null;
}

// --- Main RunTrace ---

interface RunTraceProps {
  runId: string;
}

export function RunTrace({ runId }: RunTraceProps) {
  const [log, setLog] = useState<string | null>(null);
  const [adapterPayload, setAdapterPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    setLoading(true);
    setLog(null);
    setAdapterPayload(null);
    Promise.all([
      api.getRunLog(runId).then((r) => setLog(r.content)).catch(() => {}),
      api.getRunEvents(runId).then((events) => {
        const invokeEvent = events.find((e) => e.eventType === "adapter.invoke");
        if (invokeEvent?.payload) setAdapterPayload(invokeEvent.payload as Record<string, unknown>);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        <span className="text-sm font-medium">로그 로딩 중…</span>
      </div>
    );
  }

  const entries = log ? parseLog(log) : [];

  const errors = entries.filter(
    (e) => (e.kind === "tool_result" && e.isError) ||
           (e.kind === "stderr" && /error|exception|failed/i.test(e.message))
  );

  const turnSummary = entries.findLast((e) => e.kind === "turn_summary") as Extract<LogEntry, { kind: "turn_summary" }> | undefined;

  const prompt = adapterPayload?.prompt as string | undefined;
  const context = adapterPayload?.context as Record<string, unknown> | undefined;
  const wakeReason = context?.wakeReason as string | undefined;
  const adapterType = adapterPayload?.adapterType as string | undefined;

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">❌</span>
            <span className="text-xs font-black text-red-700 uppercase tracking-wide">
              {errors.length}개 오류 감지됨
            </span>
          </div>
          {errors.slice(0, 3).map((e, i) => (
            <div key={i} className="text-xs text-red-600 font-mono leading-relaxed">
              {e.kind === "tool_result"
                ? `exit_code≠0: ${e.output.slice(0, 200)}`
                : e.kind === "stderr" ? e.message.slice(0, 200) : ""}
            </div>
          ))}
        </div>
      )}

      {/* Token summary badge */}
      {turnSummary && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-600">
          <span className="text-sm">📊</span>
          <span>in: <strong>{turnSummary.inputTokens.toLocaleString()}</strong></span>
          <span>out: <strong>{turnSummary.outputTokens.toLocaleString()}</strong></span>
          {turnSummary.cost != null && <span className="text-gray-400">${turnSummary.cost.toFixed(4)}</span>}
          {turnSummary.durationMs != null && <span className="text-gray-400">{(turnSummary.durationMs / 1000).toFixed(1)}s</span>}
        </div>
      )}

      {/* Context (injected prompt) */}
      {prompt && (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <button
            onClick={() => setShowContext((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">컨텍스트 (주입된 프롬프트)</span>
              {wakeReason && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 ring-1 ring-blue-200 font-mono">
                  {wakeReason}
                </span>
              )}
              {adapterType && <span className="text-[10px] text-gray-500 font-mono">{adapterType}</span>}
              <span className="text-[10px] text-gray-400 font-mono">{prompt.length.toLocaleString()}자</span>
            </div>
            <span className="text-gray-400 text-[10px] font-mono shrink-0 ml-2">
              {showContext ? "▼ 접기" : "▶ 펼치기"}
            </span>
          </button>
          {showContext && (
            <div className="border-t border-gray-100 max-h-96 overflow-y-auto bg-slate-950">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-words leading-relaxed p-4">
                {prompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Execution trace */}
      {entries.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">실행 로그 없음</div>
      ) : (
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
            실행 흐름 — {entries.length}개 이벤트
          </div>
          <div className="space-y-0.5">
            {entries.map((entry, idx) => (
              <TraceEntry key={idx} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
