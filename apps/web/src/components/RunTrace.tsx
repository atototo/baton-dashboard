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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Timestamp({ ts }: { ts: string }) {
  const t = new Date(ts).toLocaleTimeString("ko-KR", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  return <span className="text-[10px] text-gray-500 font-mono shrink-0 w-14">{t}</span>;
}

function ExpandBtn({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] text-gray-400 hover:text-gray-600 font-mono px-1 rounded transition-colors shrink-0"
    >
      {expanded ? "▼" : "▶ 펼치기"}
    </button>
  );
}

const TOOL_NAME_SHORT: Record<string, string> = {
  command_execution: "EXEC", bash: "BASH",
  str_replace_based_edit_tool: "EDIT", str_replace_editor: "EDIT", edit_file: "EDIT",
  read_file: "READ", write_file: "WRITE", computer: "COMPUTER",
};

function getInputSummary(_name: string, input: string): string {
  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    if (typeof parsed.command === "string") return parsed.command;
    if (typeof parsed.path === "string") return parsed.path;
    if (typeof parsed.file_path === "string") return parsed.file_path;
    if (typeof parsed.old_string === "string") return parsed.old_string.slice(0, 300);
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
      <div className="flex items-start gap-2 py-0.5">
        <Timestamp ts={entry.ts} />
        <span className="text-[11px] text-blue-600 font-mono leading-relaxed break-all">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "stderr") {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <Timestamp ts={entry.ts} />
        <span className="text-[11px] text-red-500 font-mono leading-relaxed break-all">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <div className="my-1.5 border-l-2 border-violet-400 pl-3 py-1.5 bg-violet-50 rounded-r">
        <div className="flex items-center gap-2 mb-1">
          <Timestamp ts={entry.ts} />
          <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Agent</span>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{entry.text}</p>
      </div>
    );
  }

  if (entry.kind === "thinking") {
    return (
      <div className="my-1 border-l-2 border-amber-400 pl-3 py-1 bg-amber-50 rounded-r">
        <div className="flex items-center gap-2">
          <Timestamp ts={entry.ts} />
          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Thinking</span>
          <ExpandBtn expanded={expanded} onClick={() => setExpanded((v) => !v)} />
        </div>
        {expanded && (
          <p className="text-[11px] text-amber-800 leading-relaxed whitespace-pre-wrap font-mono mt-1">{entry.text}</p>
        )}
      </div>
    );
  }

  if (entry.kind === "turn_summary") {
    return null;
  }

  if (entry.kind === "tool_call") {
    const shortName = TOOL_NAME_SHORT[entry.name] ?? entry.name.toUpperCase();
    const summary = getInputSummary(entry.name, entry.input);

    let parsedInput: Record<string, unknown> | null = null;
    let fullInput = entry.input;
    try {
      parsedInput = JSON.parse(entry.input) as Record<string, unknown>;
      fullInput = JSON.stringify(parsedInput, null, 2);
    } catch { /* keep as-is */ }

    const extraFields = parsedInput
      ? Object.keys(parsedInput).filter((k) => !["command", "path", "file_path"].includes(k))
      : [];
    const hasExtra = extraFields.length > 0;

    return (
      <div className="my-1 rounded overflow-hidden border border-gray-200">
        <div className="flex items-start gap-2 px-2.5 py-2 bg-gray-50">
          <Timestamp ts={entry.ts} />
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded font-mono shrink-0 mt-0.5">{shortName}</span>
          <pre className="text-[11px] text-gray-800 font-mono whitespace-pre-wrap break-all leading-snug flex-1 min-w-0">
            {summary}
          </pre>
          {hasExtra && <ExpandBtn expanded={expanded} onClick={() => setExpanded((v) => !v)} />}
        </div>
        {expanded && hasExtra && (
          <div className="border-t border-gray-200 bg-white px-3 py-2">
            <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-all leading-snug">
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

    if (!isErr && isEmpty) {
      return (
        <div className="flex items-center gap-2 py-0.5 pl-0.5">
          <Timestamp ts={entry.ts} />
          <span className="text-[10px] font-bold text-emerald-600 font-mono">{exitLabel || "exit:0"}</span>
        </div>
      );
    }

    const isLong = entry.output.length > 800;
    return (
      <div className={`my-0.5 rounded overflow-hidden border ${isErr ? "border-red-200" : "border-gray-200"}`}>
        <div className={`flex items-start gap-2 px-2.5 py-2 ${isErr ? "bg-red-50" : "bg-white"}`}>
          <Timestamp ts={entry.ts} />
          <span className={`text-[10px] font-bold font-mono shrink-0 mt-0.5 ${isErr ? "text-red-600" : "text-emerald-600"}`}>
            {exitLabel || (isErr ? "error" : "exit:0")}
          </span>
          <div className="flex-1 min-w-0">
            {entry.output.trim() && (
              <pre className={`text-[11px] font-mono whitespace-pre-wrap break-all leading-snug no-scrollbar ${
                isErr ? "text-red-700" : "text-gray-700"
              } ${isLong && !expanded ? "max-h-40 overflow-y-auto" : ""}`}>
                {entry.output}
              </pre>
            )}
          </div>
          {isLong && <ExpandBtn expanded={expanded} onClick={() => setExpanded((v) => !v)} />}
        </div>
      </div>
    );
  }

  if (entry.kind === "raw" && entry.text.trim()) {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <Timestamp ts={entry.ts} />
        <span className="text-[11px] text-gray-500 font-mono leading-relaxed whitespace-pre-wrap break-all">{entry.text}</span>
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
      <div className="flex items-center gap-2 py-6 text-gray-400">
        <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        <span className="text-xs">로딩 중…</span>
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
    <div className="space-y-2">
      {/* Token stats card — prominent, like baton's run header */}
      {turnSummary && (
        <div className="flex items-stretch border border-gray-200 rounded-lg overflow-hidden mb-3">
          {/* Left: token grid */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 flex-1">
            <div className="px-4 py-2.5">
              <div className="text-[10px] text-gray-400 mb-0.5">입력</div>
              <div className="text-base font-bold text-gray-900 font-mono">{fmtTokens(turnSummary.inputTokens)}</div>
            </div>
            <div className="px-4 py-2.5">
              <div className="text-[10px] text-gray-400 mb-0.5">출력</div>
              <div className="text-base font-bold text-gray-900 font-mono">{fmtTokens(turnSummary.outputTokens)}</div>
            </div>
            {(turnSummary.cost != null || turnSummary.durationMs != null) && (
              <>
                <div className="px-4 py-2.5">
                  <div className="text-[10px] text-gray-400 mb-0.5">소요 시간</div>
                  <div className="text-base font-bold text-gray-900 font-mono">
                    {turnSummary.durationMs != null ? `${(turnSummary.durationMs / 1000).toFixed(1)}s` : "–"}
                  </div>
                </div>
                <div className="px-4 py-2.5">
                  <div className="text-[10px] text-gray-400 mb-0.5">비용</div>
                  <div className="text-base font-bold text-gray-900 font-mono">
                    {turnSummary.cost != null ? `$${turnSummary.cost.toFixed(4)}` : "–"}
                  </div>
                </div>
              </>
            )}
          </div>
          {/* Right: prompt toggle */}
          {prompt && (
            <button
              onClick={() => setShowContext((v) => !v)}
              className="px-3 flex flex-col items-center justify-center gap-1 border-l border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors min-w-[80px]"
            >
              <span className="text-[9px] text-gray-400 uppercase tracking-wider">프롬프트</span>
              {wakeReason && <span className="text-[9px] bg-white border border-gray-200 px-1.5 py-0.5 rounded font-mono text-gray-500">{wakeReason}</span>}
              <span className="text-[9px] text-gray-400">{(prompt.length / 1000).toFixed(1)}k자</span>
              <span className="text-[10px] text-gray-400">{showContext ? "▼" : "▶"}</span>
            </button>
          )}
        </div>
      )}

      {/* Prompt toggle when no token summary (token summary already embeds the button) */}
      {!turnSummary && prompt && (
        <button
          onClick={() => setShowContext((v) => !v)}
          className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors mb-1"
        >
          {wakeReason && <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">{wakeReason}</span>}
          {adapterType && <span className="font-mono">{adapterType}</span>}
          <span>{(prompt.length / 1000).toFixed(1)}k자 프롬프트 {showContext ? "▼" : "▶"}</span>
        </button>
      )}

      {/* Injected prompt */}
      {showContext && prompt && (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
          <div className="max-h-80 overflow-y-auto bg-gray-50">
            <pre className="text-[11px] text-gray-700 font-mono whitespace-pre-wrap break-all leading-snug p-3">
              {prompt}
            </pre>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errors.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-[11px] text-red-600 font-mono">
          {errors.length}개 오류 ·&nbsp;
          {errors.slice(0, 1).map((e, i) => (
            <span key={i}>
              {e.kind === "tool_result" ? e.output.slice(0, 120) : e.kind === "stderr" ? e.message.slice(0, 120) : ""}
            </span>
          ))}
        </div>
      )}

      {/* Execution trace */}
      {entries.length === 0 ? (
        <div className="py-6 text-center text-gray-400 text-xs">실행 로그 없음</div>
      ) : (
        <div className="space-y-px">
          {entries.map((entry, idx) => (
            <TraceEntry key={idx} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
