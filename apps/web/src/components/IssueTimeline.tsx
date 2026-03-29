import { useEffect, useState } from "react";
import { api, type TimelineEvent as TimelineEventData } from "../lib/api";
import { RunTrace } from "./RunTrace";

interface IssueTimelineProps {
  issueId: string;
}

function formatDuration(startedAt?: string, finishedAt?: string): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

const WAKE_LABELS: Record<string, string> = {
  issue_assigned: "배정", issue_checked_out: "체크아웃", comment_added: "코멘트",
  approval_approved: "승인", approval_rejected: "거절", manual: "수동",
  on_demand: "온디맨드", automation: "자동화", assignment: "배정",
  issue_commented: "코멘트", retry_failed_run: "재시도",
};

const STATUS_DOT: Record<string, string> = {
  succeeded: "bg-emerald-500", failed: "bg-red-500",
  running: "bg-blue-500 animate-pulse",
};

const STATUS_TEXT: Record<string, string> = {
  succeeded: "text-emerald-600", failed: "text-red-600", running: "text-blue-600",
};

const ISSUE_STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500", in_progress: "bg-blue-500", in_review: "bg-amber-500",
  blocked: "bg-red-500", cancelled: "bg-gray-400", backlog: "bg-gray-300",
  todo: "bg-gray-400",
};

// ── Left panel items ────────────────────────────────────────────────────

function RunNodeItem({ event, index, isSelected, onClick, isLast }: {
  event: TimelineEventData; index: number; isSelected: boolean; onClick: () => void; isLast: boolean;
}) {
  const d = event.details;
  const status = d.status ?? "unknown";
  const dot = STATUS_DOT[status] ?? "bg-gray-300";
  const statusText = STATUS_TEXT[status] ?? "text-gray-500";
  const duration = formatDuration(d.startedAt, d.finishedAt);
  const wake = d.contextSnapshot?.wakeReason ?? d.contextSnapshot?.wakeSource ?? d.invocationSource ?? "";
  const wakeLabel = WAKE_LABELS[wake] ?? wake;
  const agentName = d.agentName ?? "에이전트";
  const agentIcon = d.agentIcon && /\p{Emoji}/u.test(d.agentIcon) ? d.agentIcon : "🤖";

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onClick}
        className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors
          ${isSelected
            ? "bg-white border border-gray-300 shadow-sm"
            : "hover:bg-white/70 border border-transparent"
          }`}
      >
        {/* Row 1: index + dot + status + duration */}
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold text-gray-400 w-3.5 shrink-0">{index}</span>
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          <span className={`text-[10px] font-bold uppercase ${statusText}`}>{status}</span>
          {duration && <span className="text-[10px] text-gray-400 font-mono ml-auto">{duration}</span>}
        </div>
        {/* Row 2: agent name */}
        <div className="flex items-center gap-1.5 pl-5">
          <span className="text-xs">{agentIcon}</span>
          <span className="text-xs font-semibold text-gray-800 truncate">{agentName}</span>
        </div>
        {/* Row 3: wake + time */}
        <div className="flex items-center gap-1.5 pl-5 mt-0.5">
          {wakeLabel && (
            <span className="text-[10px] text-gray-500 bg-gray-100 px-1 rounded font-mono shrink-0">{wakeLabel}</span>
          )}
          {d.startedAt && (
            <span className="text-[10px] text-gray-400 font-mono">{formatTime(d.startedAt)}</span>
          )}
        </div>
      </button>
      {!isLast && <div className="w-px h-2 bg-gray-200 shrink-0" />}
    </div>
  );
}

function CommentNodeItem({ event, isSelected, onClick, isLast }: {
  event: TimelineEventData; isSelected: boolean; onClick: () => void; isLast: boolean;
}) {
  const d = event.details;
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onClick}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors
          ${isSelected ? "bg-white border border-gray-300 shadow-sm" : "hover:bg-white/70 border border-transparent"}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">💬</span>
          <span className="text-xs text-gray-700 truncate">{d.authorAgentName ?? "코멘트"}</span>
          <span className="text-[10px] text-gray-400 font-mono ml-auto shrink-0">{formatTime(event.createdAt)}</span>
        </div>
        {d.body && (
          <p className="text-[10px] text-gray-400 truncate pl-4 mt-0.5">{d.body}</p>
        )}
      </button>
      {!isLast && <div className="w-px h-2 bg-gray-200 shrink-0" />}
    </div>
  );
}

function ApprovalNodeItem({ event, isSelected, onClick, isLast }: {
  event: TimelineEventData; isSelected: boolean; onClick: () => void; isLast: boolean;
}) {
  const d = event.details;
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onClick}
        className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors
          ${isSelected ? "bg-white border border-amber-200 shadow-sm" : "hover:bg-amber-50/50 border border-transparent"}`}
      >
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">⚖️</span>
          <span className="text-xs text-amber-700 truncate">{d.approvalType ?? "승인"}</span>
          <span className="text-[10px] text-gray-400 font-mono ml-auto shrink-0">{formatTime(event.createdAt)}</span>
        </div>
      </button>
      {!isLast && <div className="w-px h-2 bg-gray-200 shrink-0" />}
    </div>
  );
}

function ActivityNodeItem({ event, isLast }: { event: TimelineEventData; isLast: boolean }) {
  const d = event.details;
  const newStatus = d.newStatus ?? d.status;
  const dotColor = newStatus ? (ISSUE_STATUS_DOT[newStatus] ?? "bg-gray-300") : "bg-gray-200";
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1 w-full">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} ml-1 shrink-0`} />
        {newStatus && <span className="text-[10px] text-gray-500 font-mono">{newStatus}</span>}
        <span className="text-[10px] text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
      </div>
      {!isLast && <div className="w-px h-1 bg-gray-100 shrink-0" />}
    </div>
  );
}

// ── Right panel ──────────────────────────────────────────────────────────

function RunDetail({ event }: { event: TimelineEventData }) {
  const d = event.details;
  const status = d.status ?? "unknown";
  const dot = STATUS_DOT[status] ?? "bg-gray-300";
  const statusText = STATUS_TEXT[status] ?? "text-gray-500";
  const duration = formatDuration(d.startedAt, d.finishedAt);
  const wake = d.contextSnapshot?.wakeReason ?? d.contextSnapshot?.wakeSource ?? d.invocationSource ?? "";
  const wakeLabel = WAKE_LABELS[wake] ?? wake;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-3">
        <span className="text-sm">
          {d.agentIcon && /\p{Emoji}/u.test(d.agentIcon) ? d.agentIcon : "🤖"}
        </span>
        <span className="text-sm font-bold text-gray-900">{d.agentName ?? "에이전트"}</span>
        <div className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className={`text-xs font-mono font-semibold ${statusText}`}>{status}</span>
        {duration && <span className="text-xs text-gray-400 font-mono">⏱ {duration}</span>}
        {wakeLabel && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 rounded font-mono">{wakeLabel}</span>}
        {d.startedAt && (
          <span className="text-[10px] text-gray-400 font-mono ml-auto">
            {formatTime(d.startedAt)}{d.finishedAt && ` → ${formatTime(d.finishedAt)}`}
          </span>
        )}
        {event.runId && (
          <span className="text-[10px] text-gray-300 font-mono shrink-0">{event.runId.slice(0, 8)}…</span>
        )}
      </div>
      {/* Trace */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {event.runId ? (
          <div className="p-4">
            <RunTrace runId={event.runId} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">실행 로그 없음</div>
        )}
      </div>
    </div>
  );
}

function CommentDetail({ event }: { event: TimelineEventData }) {
  const d = event.details;
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-sm">💬</span>
        <span className="text-sm font-bold text-gray-900">{d.authorAgentName ?? "코멘트"}</span>
        <span className="text-xs text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{d.body}</p>
      </div>
    </div>
  );
}

function ApprovalDetail({ event }: { event: TimelineEventData }) {
  const d = event.details;
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 shrink-0 flex items-center gap-2">
        <span className="text-sm">⚖️</span>
        <span className="text-sm font-bold text-amber-800">{d.approvalType} 승인 요청</span>
        <span className="text-xs text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {d.payload ? (
          <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto font-mono leading-relaxed">
            {JSON.stringify(d.payload, null, 2)}
          </pre>
        ) : (
          <div className="text-sm text-gray-400">페이로드 없음</div>
        )}
      </div>
    </div>
  );
}

function EmptyDetail() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
      <div className="text-2xl">←</div>
      <div className="text-xs text-gray-400">왼쪽에서 노드를 선택하세요</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function IssueTimeline({ issueId }: IssueTimelineProps) {
  const [events, setEvents] = useState<TimelineEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.getIssueTimeline(issueId)
      .then((evts) => {
        setEvents(evts);
        const firstRun = evts.find((e) => e.type === "run");
        if (firstRun) setSelectedId(firstRun.id);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex border border-gray-200 rounded-xl overflow-hidden h-full">
        <div className="w-64 bg-gray-50 border-r border-gray-100 p-2 space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="flex-1 bg-white p-4">
          <div className="h-full bg-gray-50 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-xl border border-gray-200 text-gray-400 text-sm">
        타임라인 이벤트가 없습니다
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;
  let runIndex = 0;

  return (
    <div className="flex border border-gray-200 rounded-xl overflow-hidden h-full">
      {/* ── Left: node list ── */}
      <div className="w-64 shrink-0 bg-gray-50 border-r border-gray-100 overflow-y-auto py-2 px-1.5">
        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1.5">실행 흐름</div>
        {events.map((event, idx) => {
          const isSelected = event.id === selectedId;
          const toggle = () => setSelectedId(isSelected ? null : event.id);
          const isLast = idx === events.length - 1;
          if (event.type === "run") {
            runIndex++;
            return <RunNodeItem key={event.id} event={event} index={runIndex} isSelected={isSelected} onClick={toggle} isLast={isLast} />;
          }
          if (event.type === "comment") {
            return <CommentNodeItem key={event.id} event={event} isSelected={isSelected} onClick={toggle} isLast={isLast} />;
          }
          if (event.type === "approval") {
            return <ApprovalNodeItem key={event.id} event={event} isSelected={isSelected} onClick={toggle} isLast={isLast} />;
          }
          return <ActivityNodeItem key={event.id} event={event} isLast={isLast} />;
        })}
      </div>

      {/* ── Right: detail ── */}
      <div className="flex-1 overflow-hidden bg-white no-scrollbar">
        {selectedEvent?.type === "run" && <RunDetail event={selectedEvent} />}
        {selectedEvent?.type === "comment" && <CommentDetail event={selectedEvent} />}
        {selectedEvent?.type === "approval" && <ApprovalDetail event={selectedEvent} />}
        {!selectedEvent && <EmptyDetail />}
      </div>
    </div>
  );
}
