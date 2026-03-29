import { useState, useEffect } from "react";
import { api } from "../lib/api";

// --- Types ---

type LogEntry =
  | { kind: "system"; ts: string; message: string }
  | { kind: "stderr"; ts: string; message: string }
  | { kind: "assistant"; ts: string; text: string }
  | { kind: "tool_call"; ts: string; name: string; input: string; callId: string }
  | { kind: "tool_result"; ts: string; callId: string; output: string; exitCode?: number; isError: boolean }
  | { kind: "raw"; ts: string; stream: string; text: string };

// --- Parse logic ---

function parseLog(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    let outer: { ts?: string; stream?: string; chunk?: string };
    try {
      outer = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = outer.ts ?? new Date().toISOString();
    const stream = outer.stream ?? "stdout";
    const chunk = outer.chunk ?? "";
    if (!chunk.trim()) continue;

    if (stream === "stderr") {
      if (chunk.trim().startsWith("[baton]")) {
        entries.push({ kind: "system", ts, message: chunk.trim() });
      } else {
        entries.push({ kind: "stderr", ts, message: chunk.trim() });
      }
      continue;
    }

    // Try to parse stdout as JSON
    let inner: Record<string, unknown>;
    try {
      inner = JSON.parse(chunk.trim()) as Record<string, unknown>;
    } catch {
      entries.push({ kind: "raw", ts, stream, text: chunk.trim() });
      continue;
    }

    // Codex item format: item.started → skip (we handle item.completed)
    if (inner.type === "item.started") continue;

    // Codex item format: item.completed
    if (inner.type === "item.completed") {
      const item = inner.item as Record<string, unknown> | undefined;
      if (!item) continue;

      if (item.type === "agent_message") {
        const text = typeof item.text === "string" ? item.text : "";
        if (text) entries.push({ kind: "assistant", ts, text });
        continue;
      }

      if (item.type === "command_execution") {
        const cmd = typeof item.command === "string" ? item.command : JSON.stringify(item.command ?? "");
        const output = typeof item.output === "string" ? item.output : JSON.stringify(item.output ?? "");
        const exitCode = item.exit_code as number | undefined;
        const callId = (item.id as string) ?? "";
        entries.push({ kind: "tool_call", ts, name: "command_execution", input: JSON.stringify({ command: cmd }), callId });
        entries.push({ kind: "tool_result", ts, callId, output, exitCode, isError: exitCode !== undefined && exitCode !== 0 });
        continue;
      }
      continue;
    }

    // Codex turn lifecycle
    if (inner.type === "turn.started" || inner.type === "turn.completed") continue;

    // Codex format: assistant message (older format)
    if (inner.type === "message" && inner.role === "assistant") {
      const textContent = ((inner.content ?? []) as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
      if (textContent) entries.push({ kind: "assistant", ts, text: textContent });
      continue;
    }

    // Codex format: tool_call (older format)
    if (inner.type === "tool_call") {
      const params = inner.parameters;
      entries.push({
        kind: "tool_call",
        ts,
        name: (inner.name as string) ?? "unknown",
        input: typeof params === "object" && params !== null ? JSON.stringify(params) : String(params ?? ""),
        callId: (inner.call_id as string) ?? (inner.id as string) ?? "",
      });
      continue;
    }

    // Codex format: tool_result (older format)
    if (inner.type === "tool_result") {
      const rawOutput = inner.output;
      const output = typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput ?? "");
      const exitCode = inner.exit_code as number | undefined;
      entries.push({
        kind: "tool_result",
        ts,
        callId: (inner.call_id as string) ?? "",
        output,
        exitCode,
        isError: (exitCode !== undefined && exitCode !== 0) || !!(inner.is_error),
      });
      continue;
    }

    // Claude format: content_block_start with tool_use
    if (inner.type === "content_block_start") {
      const cb = inner.content_block as Record<string, unknown> | undefined;
      if (cb?.type === "tool_use") {
        entries.push({
          kind: "tool_call",
          ts,
          name: (cb.name as string) ?? "unknown",
          input: JSON.stringify(cb.input ?? {}),
          callId: (cb.id as string) ?? "",
        });
        continue;
      }
    }

    // Claude format: content_block_delta text
    if (inner.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        const last = [...entries].reverse().find((e) => e.kind === "assistant");
        if (last && last.kind === "assistant") {
          (last as { kind: "assistant"; ts: string; text: string }).text += delta.text;
        } else {
          entries.push({ kind: "assistant", ts, text: delta.text });
        }
        continue;
      }
    }

    // Skip stop/lifecycle noise
    if (
      [
        "thread.started",
        "thread.completed",
        "message_start",
        "message_stop",
        "message_delta",
        "content_block_stop",
        "ping",
      ].includes(inner.type as string)
    ) {
      continue;
    }

    // Everything else as raw
    entries.push({ kind: "raw", ts, stream, text: chunk.trim().slice(0, 200) });
  }

  return entries;
}

// --- TraceEntry sub-component ---

function TraceEntry({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(entry.ts).toLocaleTimeString("ko-KR", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (entry.kind === "system") {
    return (
      <div className="flex items-start gap-2 py-0.5 opacity-60">
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <span className="text-xs text-blue-400 font-mono">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "stderr") {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <span className="text-xs text-red-400 font-mono">{entry.message}</span>
      </div>
    );
  }

  if (entry.kind === "assistant") {
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          <span className="text-xs shrink-0">🤖</span>
          <span className="text-xs text-gray-600 italic line-clamp-3">{entry.text}</span>
        </div>
      </div>
    );
  }

  if (entry.kind === "tool_call") {
    const toolIcon: Record<string, string> = {
      command_execution: "⚡",
      bash: "⚡",
      str_replace_based_edit_tool: "✏️",
      str_replace_editor: "✏️",
      edit_file: "✏️",
      read_file: "📖",
      write_file: "📝",
      computer: "🖥️",
    };
    const icon = toolIcon[entry.name] ?? "🔧";

    let inputSummary = "";
    try {
      const parsed = JSON.parse(entry.input) as Record<string, unknown>;
      if (typeof parsed.command === "string") inputSummary = parsed.command.slice(0, 80);
      else if (typeof parsed.path === "string") inputSummary = parsed.path;
      else if (typeof parsed.file_path === "string") inputSummary = parsed.file_path;
      else inputSummary = entry.input.slice(0, 80);
    } catch {
      inputSummary = entry.input.slice(0, 80);
    }

    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{icon}</span>
            <span className="text-xs font-bold text-gray-700">{entry.name}</span>
            <span className="text-xs text-gray-400 truncate max-w-xs">{inputSummary}</span>
            <span className="text-xs text-gray-300 shrink-0">{expanded ? "▲" : "▼"}</span>
          </div>
          {expanded && (
            <div className="mt-1 ml-5 bg-gray-50 rounded p-2 font-mono text-xs text-gray-600 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(entry.input), null, 2);
                } catch {
                  return entry.input;
                }
              })()}
            </div>
          )}
        </button>
      </div>
    );
  }

  if (entry.kind === "tool_result") {
    const isErr = entry.isError || (entry.exitCode !== undefined && entry.exitCode !== 0);
    return (
      <div className={`flex items-start gap-2 py-1 ${isErr ? "bg-red-50 -mx-1 px-1 rounded" : ""}`}>
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{isErr ? "❌" : "✅"}</span>
            {entry.exitCode !== undefined && (
              <span className={`text-xs font-bold ${isErr ? "text-red-600" : "text-green-600"}`}>
                exit:{entry.exitCode}
              </span>
            )}
            <span className={`text-xs truncate max-w-xs ${isErr ? "text-red-500" : "text-gray-400"}`}>
              {entry.output.slice(0, 100)}
            </span>
            {entry.output.length > 100 && (
              <span className="text-xs text-gray-300 shrink-0">{expanded ? "▲" : "▼"}</span>
            )}
          </div>
          {expanded && (
            <div
              className={`mt-1 ml-5 rounded p-2 font-mono text-xs max-h-40 overflow-y-auto whitespace-pre-wrap ${
                isErr ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-600"
              }`}
            >
              {entry.output}
            </div>
          )}
        </button>
      </div>
    );
  }

  // raw — only show if meaningful
  if (entry.kind === "raw" && entry.text && entry.text.trim()) {
    return (
      <div className="flex items-start gap-2 py-0.5 opacity-40">
        <span className="text-xs text-gray-300 shrink-0 mt-0.5 w-14">{ts}</span>
        <span className="text-xs text-gray-400 font-mono truncate">{entry.text.slice(0, 100)}</span>
      </div>
    );
  }

  return null;
}

// --- Main RunTrace component ---

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
      api
        .getRunLog(runId)
        .then((r) => setLog(r.content))
        .catch(() => {}),
      api
        .getRunEvents(runId)
        .then((events) => {
          const invokeEvent = events.find((e) => e.eventType === "adapter.invoke");
          if (invokeEvent?.payload) {
            setAdapterPayload(invokeEvent.payload as Record<string, unknown>);
          }
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="text-xs text-gray-400 animate-pulse py-4">실행 로그 로딩 중...</div>
    );
  }

  const entries = log ? parseLog(log) : [];

  // Find errors
  const errors = entries.filter(
    (e) =>
      (e.kind === "tool_result" && e.isError) ||
      (e.kind === "stderr" && /error|exception|failed/i.test(e.message))
  );
  const hasErrors = errors.length > 0;

  const prompt = adapterPayload?.prompt as string | undefined;
  const context = adapterPayload?.context as Record<string, unknown> | undefined;
  const wakeReason = context?.wakeReason as string | undefined;
  const adapterType = adapterPayload?.adapterType as string | undefined;

  return (
    <div className="space-y-3">
      {/* Error banner */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="text-red-500 text-sm shrink-0">❌</span>
          <div>
            <div className="text-xs font-black text-red-700 uppercase tracking-wide mb-1">
              {errors.length}개 오류 감지됨
            </div>
            {errors.slice(0, 2).map((e, i) => (
              <div key={i} className="text-xs text-red-600 font-mono">
                {e.kind === "tool_result"
                  ? `exit_code≠0: ${e.output.slice(0, 100)}`
                  : e.kind === "stderr"
                  ? e.message.slice(0, 100)
                  : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context section */}
      {prompt && (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowContext((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">컨텍스트</span>
              {wakeReason && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-white text-gray-500 font-bold ring-1 ring-gray-200">
                  {wakeReason}
                </span>
              )}
              {adapterType && <span className="text-xs text-gray-400">{adapterType}</span>}
              <span className="text-xs text-gray-400">{prompt.length.toLocaleString()}자</span>
            </div>
            <span className={`text-gray-300 text-xs transition-transform ${showContext ? "rotate-180" : ""}`}>▼</span>
          </button>
          {showContext && (
            <div className="max-h-80 overflow-y-auto p-3 bg-white">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                {prompt}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Execution trace */}
      {entries.length === 0 ? (
        <div className="text-xs text-gray-400 py-2 text-center">실행 로그 없음</div>
      ) : (
        <div className="space-y-0.5">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">실행 흐름</div>
          {entries.map((entry, idx) => (
            <TraceEntry key={idx} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
