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
  issue_assigned: "배정",
  issue_checked_out: "체크아웃",
  comment_added: "코멘트",
  approval_approved: "승인",
  approval_rejected: "거절",
  manual: "수동",
  on_demand: "온디맨드",
  automation: "자동화",
  assignment: "배정",
  retry_failed_run: "재시도",
};

// ── Status helpers ──────────────────────────────────────────────────────

const RUN_STATUS = {
  succeeded: {
    bar: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    card: "border-l-emerald-400",
    selected: "ring-2 ring-emerald-100 border-emerald-300",
  },
  failed: {
    bar: "bg-red-500",
    badge: "bg-red-50 text-red-700 ring-1 ring-red-200",
    dot: "bg-red-500",
    card: "border-l-red-400",
    selected: "ring-2 ring-red-100 border-red-300",
  },
  running: {
    bar: "bg-blue-500 animate-pulse",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dot: "bg-blue-500 animate-pulse",
    card: "border-l-blue-400",
    selected: "ring-2 ring-blue-100 border-blue-300",
  },
};

function getRunStatus(s?: string) {
  return RUN_STATUS[s as keyof typeof RUN_STATUS] ?? {
    bar: "bg-gray-300",
    badge: "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
    dot: "bg-gray-300",
    card: "border-l-gray-300",
    selected: "ring-2 ring-gray-100 border-gray-300",
  };
}

const STATUS_COLORS: Record<string, string> = {
  done: "bg-emerald-500", in_progress: "bg-blue-500", in_review: "bg-amber-500",
  blocked: "bg-red-500", cancelled: "bg-gray-400", backlog: "bg-gray-300",
};

// ── Left panel node items ───────────────────────────────────────────────

function RunNodeItem({ event, index, isSelected, onClick, isLast }: {
  event: TimelineEventData; index: number; isSelected: boolean; onClick: () => void; isLast: boolean;
}) {
  const d = event.details;
  const status = d.status ?? "unknown";
  const st = getRunStatus(status);
  const duration = formatDuration(d.startedAt, d.finishedAt);
  const wake = d.contextSnapshot?.wakeReason ?? d.contextSnapshot?.wakeSource ?? d.invocationSource ?? "";

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onClick}
        className={`w-full text-left bg-white border border-l-4 ${st.card} border-gray-200 rounded-xl p-3 shadow-sm transition-all
          hover:border-gray-300 hover:shadow-md
          ${isSelected ? st.selected : ""}`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-800 text-white text-[10px] font-black shrink-0">
            {index}
          </div>
          <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-tight ${st.badge}`}>{status}</span>
          {duration && <span className="text-[10px] text-gray-400 ml-auto font-mono">{duration}</span>}
        </div>
        <div className="text-sm font-bold text-gray-800 truncate">
          {d.agentIcon && /\p{Emoji}/u.test(d.agentIcon) ? d.agentIcon : "🤖"} {d.agentName ?? "에이전트"}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {wake && (
            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
              {WAKE_LABELS[wake] ?? wake}
            </span>
          )}
          <span className="text-[10px] text-gray-400 font-mono">
            {d.startedAt ? formatTime(d.startedAt) : ""}
          </span>
        </div>
      </button>
      {!isLast && <div className="w-px h-3 bg-gray-200 shrink-0" />}
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
        className={`w-full text-left bg-white border border-gray-200 rounded-xl p-2.5 shadow-sm transition-all
          hover:border-gray-300 hover:shadow-md
          ${isSelected ? "ring-2 ring-gray-200 border-gray-300" : ""}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">💬</span>
          <span className="text-xs font-bold text-gray-700 truncate">{d.authorAgentName ?? "코멘트"}</span>
          <span className="text-[10px] text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
        </div>
        {d.body && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{d.body}</p>
        )}
      </button>
      {!isLast && <div className="w-px h-3 bg-gray-200 shrink-0" />}
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
        className={`w-full text-left bg-white border border-amber-200 rounded-xl p-2.5 shadow-sm transition-all
          hover:border-amber-300 hover:shadow-md
          ${isSelected ? "ring-2 ring-amber-100 border-amber-300" : ""}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">⚖️</span>
          <span className="text-xs font-bold text-amber-700 truncate">{d.approvalType ?? "승인"}</span>
          <span className="text-[10px] text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
        </div>
      </button>
      {!isLast && <div className="w-px h-3 bg-gray-200 shrink-0" />}
    </div>
  );
}

function ActivityNodeItem({ event, isLast }: { event: TimelineEventData; isLast: boolean }) {
  const d = event.details;
  const newStatus = d.newStatus ?? d.status;
  const dotColor = newStatus ? (STATUS_COLORS[newStatus] ?? "bg-gray-300") : "bg-gray-200";

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 py-1 px-2 w-full">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-white shadow-sm shrink-0`} />
        {newStatus && <span className="text-[10px] text-gray-500 font-mono">{newStatus}</span>}
        <span className="text-[10px] text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
      </div>
      {!isLast && <div className="w-px h-1 bg-gray-100 shrink-0" />}
    </div>
  );
}

// ── Right panel ─────────────────────────────────────────────────────────

function RunDetail({ event }: { event: TimelineEventData }) {
  const d = event.details;
  const status = d.status ?? "unknown";
  const st = getRunStatus(status);
  const duration = formatDuration(d.startedAt, d.finishedAt);
  const wake = d.contextSnapshot?.wakeReason ?? d.contextSnapshot?.wakeSource ?? d.invocationSource ?? "";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">
                {d.agentIcon && /\p{Emoji}/u.test(d.agentIcon) ? d.agentIcon : "🤖"}
              </span>
              <span className="text-sm font-black text-gray-900 tracking-tight">{d.agentName ?? "에이전트"}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-tight ${st.badge}`}>{status}</span>
              {duration && <span className="text-xs text-gray-500 font-mono">⏱ {duration}</span>}
              {wake && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                  {WAKE_LABELS[wake] ?? wake}
                </span>
              )}
            </div>
          </div>
          {event.runId && (
            <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-1">{event.runId.slice(0, 8)}…</span>
          )}
        </div>
        {d.startedAt && (
          <div className="text-[10px] text-gray-400 font-mono">
            {formatTime(d.startedAt)} {d.finishedAt && `→ ${formatTime(d.finishedAt)}`}
          </div>
        )}
      </div>
      {/* Trace body */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50">
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
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-black text-gray-900">{d.authorAgentName ?? "코멘트"}</span>
          <span className="text-xs text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium">{d.body}</p>
      </div>
    </div>
  );
}

function ApprovalDetail({ event }: { event: TimelineEventData }) {
  const d = event.details;
  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">⚖️</span>
          <span className="text-sm font-black text-amber-800">{d.approvalType} 승인 요청</span>
          <span className="text-xs text-gray-400 font-mono ml-auto">{formatTime(event.createdAt)}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 bg-gray-50/50">
        {d.payload ? (
          <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded-xl p-4 overflow-auto font-mono leading-relaxed">
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
    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-50/30">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-300 text-xl">←</div>
      <div className="text-sm font-medium text-gray-400">왼쪽에서 노드를 선택하세요</div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────

export function IssueTimeline({ issueId }: IssueTimelineProps) {
  const [events, setEvents] = useState<TimelineEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    api.getIssueTimeline(issueId)
      .then((evts) => {
        setEvents(evts);
        // Auto-select first run
        const firstRun = evts.find((e) => e.type === "run");
        if (firstRun) setSelectedId(firstRun.id);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-[680px]">
        <div className="w-72 bg-gray-50 border-r border-gray-100 p-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="flex-1 bg-white p-4">
          <div className="h-full bg-gray-50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400">
        <div className="text-center">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm font-medium">타임라인 이벤트가 없습니다</div>
        </div>
      </div>
    );
  }

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null;
  let runIndex = 0;

  return (
    <div className="flex border border-gray-200 rounded-2xl shadow-sm overflow-hidden h-[720px]">
      {/* ── Left: node pipeline ── */}
      <div className="w-72 shrink-0 bg-gray-50 border-r border-gray-100 overflow-y-auto p-3">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3 px-1">실행 흐름</div>
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
      <div className="flex-1 overflow-hidden bg-white">
        {selectedEvent?.type === "run" && <RunDetail event={selectedEvent} />}
        {selectedEvent?.type === "comment" && <CommentDetail event={selectedEvent} />}
        {selectedEvent?.type === "approval" && <ApprovalDetail event={selectedEvent} />}
        {!selectedEvent && <EmptyDetail />}
      </div>
    </div>
  );
}
