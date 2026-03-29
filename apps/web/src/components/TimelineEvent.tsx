import { useState, useEffect } from "react";
import { api, type TimelineEvent as TimelineEventData, type RunEvent } from "../lib/api";
import { PromptSnapshot } from "./PromptSnapshot";

interface TimelineEventProps {
  event: TimelineEventData;
  isLast?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  "issue.created": "이슈 생성됨",
  "issue.updated": "이슈 업데이트됨",
  "issue.status_changed": "상태 변경됨",
  "issue.assigned": "담당자 배정됨",
  "issue.checkout": "에이전트 체크아웃",
  "issue.released": "에이전트 릴리즈",
  "issue.completed": "이슈 완료됨",
  "issue.cancelled": "이슈 취소됨",
  "issue.blocked": "블록됨",
  "issue.in_review": "리뷰 요청됨",
  "issue.comment_added": "코멘트 추가됨",
  "heartbeat_run": "에이전트 실행",
  "approval.linked": "승인 요청 연결됨",
};

const getDotColor = (event: TimelineEventData): string => {
  if (event.type === "run") return "bg-blue-400 ring-blue-100";
  if (event.type === "comment") return "bg-gray-400 ring-gray-100";
  if (event.type === "approval") return "bg-amber-400 ring-amber-100";
  // activity — vary by action
  const action = event.action;
  if (action.includes("completed") || action.includes("done")) return "bg-green-400 ring-green-100";
  if (action.includes("cancelled")) return "bg-red-400 ring-red-100";
  if (action.includes("blocked")) return "bg-orange-400 ring-orange-100";
  if (action.includes("in_review")) return "bg-yellow-400 ring-yellow-100";
  if (action.includes("in_progress")) return "bg-blue-400 ring-blue-100";
  return "bg-gray-300 ring-gray-100";
};

function formatDuration(startedAt?: string, finishedAt?: string): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function formatRunStatus(status?: string): { label: string; className: string } {
  if (status === "finished") return { label: "SUCCEEDED", className: "bg-green-100 text-green-700" };
  if (status === "failed") return { label: "FAILED", className: "bg-red-100 text-red-700" };
  if (status === "running") return { label: "RUNNING", className: "bg-blue-100 text-blue-700" };
  return { label: status?.toUpperCase() ?? "UNKNOWN", className: "bg-gray-100 text-gray-600" };
}

export function TimelineEvent({ event, isLast = false }: TimelineEventProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<RunEvent[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const dateStr = new Date(event.createdAt).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  useEffect(() => {
    if (showLogs && event.runId && logs.length === 0) {
      setLoadingLogs(true);
      api.getRunEvents(event.runId)
        .then(setLogs)
        .catch(console.error)
        .finally(() => setLoadingLogs(false));
    }
  }, [showLogs, event.runId]);

  const dotColor = getDotColor(event);

  const renderContent = () => {
    switch (event.type) {
      case "comment":
        return (
          <div className="bg-white p-4 border rounded-xl shadow-sm border-gray-100 flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{event.details.authorAgentIcon || "👤"}</span>
              <span className="text-sm font-black text-gray-900">
                {event.details.authorAgentName || event.details.authorUserId || "Unknown"}
              </span>
              <span className="ml-auto text-[10px] text-gray-400 font-medium">{dateStr}</span>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{event.details.body}</div>
          </div>
        );

      case "run": {
        const { label: statusLabel, className: statusClass } = formatRunStatus(event.details.status);
        const duration = formatDuration(event.details.startedAt, event.details.finishedAt);
        return (
          <div className="bg-white p-4 border rounded-xl shadow-sm border-blue-100 ring-1 ring-blue-50/50 flex-1">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-xl mt-0.5">{event.details.agentIcon || "🤖"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-gray-900 tracking-tight">
                    {event.details.agentName}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${statusClass}`}>
                    {statusLabel}
                  </span>
                  {duration && (
                    <span className="text-[10px] text-gray-400 font-bold">⏱ {duration}</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 font-medium mt-0.5">{dateStr}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="text-[9px] text-gray-400 font-black uppercase mb-0.5">Source</div>
                <div className="text-[11px] font-bold text-gray-700">{event.details.invocationSource || "—"}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="text-[9px] text-gray-400 font-black uppercase mb-0.5">Trigger</div>
                <div className="text-[11px] font-bold text-gray-700">{event.details.triggerDetail || "—"}</div>
              </div>
            </div>

            {event.details.promptSnapshot && (
              <PromptSnapshot prompt={event.details.promptSnapshot} />
            )}
            {!event.details.promptSnapshot && event.details.contextSnapshot?.promptSnapshot && (
              <PromptSnapshot prompt={event.details.contextSnapshot.promptSnapshot} />
            )}

            <div className="mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-[11px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
              >
                {showLogs ? "실행 로그 숨기기" : "실행 로그 보기"}
                <span className="text-blue-300">{showLogs ? "▲" : "▼"}</span>
              </button>
              {showLogs && (
                <div className="mt-2 bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                  {loadingLogs ? (
                    <div className="text-gray-500 animate-pulse">로딩 중...</div>
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <div key={log.id} className="flex gap-3 mb-1.5 last:mb-0">
                        <span className="text-gray-600 select-none shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span
                          className={`font-black w-14 shrink-0 ${
                            log.level === "error"
                              ? "text-red-400"
                              : log.level === "warn"
                              ? "text-yellow-400"
                              : log.level === "debug"
                              ? "text-gray-600"
                              : "text-blue-400"
                          }`}
                        >
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="text-gray-300">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-600 italic">로그 없음</div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "approval":
        return (
          <div className="bg-white p-4 border border-amber-100 rounded-xl shadow-sm ring-1 ring-amber-50/50 flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">⚖️</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm text-amber-900 uppercase tracking-tight">
                    {event.details.approvalType}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                      event.details.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : event.details.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {event.details.status}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium">{dateStr}</div>
              </div>
            </div>
            {event.details.payload?.question && (
              <div className="text-sm text-amber-950 mt-2 font-medium bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                <div className="text-[9px] text-amber-400 font-black uppercase mb-1">Question</div>
                {event.details.payload.question}
              </div>
            )}
            {event.details.payload?.answer && (
              <div className="text-sm text-green-950 mt-2 font-medium bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                <div className="text-[9px] text-green-400 font-black uppercase mb-1">Answer</div>
                {event.details.payload.answer}
              </div>
            )}
          </div>
        );

      case "activity":
      default: {
        const label = ACTION_LABELS[event.action] ?? event.action;
        // Prefer human-readable agent name from details over raw actorId (which may be a UUID)
        const actorName =
          event.details?.agentName ||
          event.details?.authorAgentName ||
          event.details?.authorUserId ||
          event.actorId;
        const statusChange = event.details?.newStatus || event.details?.status;
        return (
          <div className="flex-1 flex items-center justify-between py-0.5 group">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-gray-700 truncate">{label}</span>
              {statusChange && (
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded font-black uppercase tracking-wide">
                  {statusChange}
                </span>
              )}
              <span className="text-xs text-gray-400 font-medium">by {actorName}</span>
            </div>
            <div className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-4">{dateStr}</div>
          </div>
        );
      }
    }
  };

  return (
    <div className={`flex items-start gap-4 ${!isLast ? "pb-4" : "pb-0"}`}>
      {/* Left: colored dot aligned with card top */}
      <div className="flex flex-col items-center shrink-0 mt-4">
        <div className={`w-3 h-3 rounded-full ring-2 ring-offset-1 shrink-0 z-10 ${dotColor}`} />
      </div>
      {/* Right: event card */}
      <div className={`flex-1 min-w-0 ${event.type === "activity" ? "py-3 border-b border-gray-50" : ""}`}>
        {renderContent()}
      </div>
    </div>
  );
}
