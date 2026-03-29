import { useEffect, useState } from "react";
import { api, type TimelineEvent as TimelineEventData } from "../lib/api";
import { RunTrace } from "./RunTrace";

interface IssueTimelineProps {
  issueId: string;
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
};

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
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// Small connector node for non-run events between stages
function ConnectorNode({ event }: { event: TimelineEventData }) {
  const d = event.details;

  if (event.type === "comment") {
    return (
      <div className="flex items-start gap-3 px-2 py-2">
        <div className="flex flex-col items-center gap-0 mt-1.5 shrink-0">
          <div className="w-px h-3 bg-gray-100" />
          <div className="w-2 h-2 rounded-full bg-gray-300 ring-2 ring-gray-50" />
          <div className="w-px h-3 bg-gray-100" />
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-[10px]">💬</span>
            <span className="text-[11px] font-bold text-gray-600">
              {d.authorAgentName ?? d.authorAgentId ?? "코멘트"}
            </span>
            <span className="text-[10px] text-gray-300">{formatTime(event.createdAt)}</span>
          </div>
          {d.body && (
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2 pl-4">{d.body}</div>
          )}
        </div>
      </div>
    );
  }

  if (event.type === "approval") {
    return (
      <div className="flex items-start gap-3 px-2 py-2">
        <div className="flex flex-col items-center gap-0 mt-1.5 shrink-0">
          <div className="w-px h-3 bg-gray-100" />
          <div className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-50" />
          <div className="w-px h-3 bg-gray-100" />
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px]">⚖️</span>
            <span className="text-[11px] font-bold text-amber-700">
              {d.approvalType} 승인 요청
            </span>
            <span className="text-[10px] text-gray-300">{formatTime(event.createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  // activity
  const statusColors: Record<string, string> = {
    done: "bg-green-400",
    in_progress: "bg-blue-400",
    in_review: "bg-yellow-400",
    blocked: "bg-red-400",
    cancelled: "bg-gray-400",
    backlog: "bg-gray-300",
  };
  const newStatus = d.newStatus ?? d.status;
  const dotColor = newStatus ? (statusColors[newStatus] ?? "bg-gray-300") : "bg-gray-200";

  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <div className="flex flex-col items-center gap-0 shrink-0">
        <div className="w-px h-2 bg-gray-100" />
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <div className="w-px h-2 bg-gray-100" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-400">
          {ACTION_LABELS[event.action] ?? event.action}
        </span>
        {newStatus && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">
            {newStatus}
          </span>
        )}
        <span className="text-[10px] text-gray-300">{formatTime(event.createdAt)}</span>
      </div>
    </div>
  );
}

// Primary run stage card
function RunStageCard({
  event,
  stageNumber,
  isSelected,
  onToggle,
}: {
  event: TimelineEventData;
  stageNumber: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const d = event.details;
  const duration = formatDuration(d.startedAt, d.finishedAt);
  const status = d.status ?? "unknown";
  const wakeReason =
    d.contextSnapshot?.wakeReason ??
    d.contextSnapshot?.wakeSource ??
    d.invocationSource ??
    "";

  const statusConfig =
    {
      succeeded: {
        label: "SUCCEEDED",
        cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
      },
      failed: {
        label: "FAILED",
        cls: "bg-red-50 text-red-700 ring-1 ring-red-200",
      },
      running: {
        label: "RUNNING",
        cls: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 animate-pulse",
      },
    }[status] ?? {
      label: status.toUpperCase(),
      cls: "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
    };

  const WAKE_LABELS: Record<string, string> = {
    issue_assigned: "배정됨",
    issue_checked_out: "체크아웃",
    comment_added: "코멘트",
    approval_approved: "승인됨",
    approval_rejected: "거절됨",
    manual: "수동 실행",
    on_demand: "온디맨드",
    automation: "자동화",
    assignment: "배정",
  };

  return (
    <div
      className={`rounded-xl border transition-all ${
        isSelected
          ? "border-blue-200 shadow-md shadow-blue-50"
          : "border-gray-100 shadow-sm hover:border-gray-200"
      }`}
    >
      {/* Stage header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        {/* Stage number badge */}
        <div className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-[10px] font-black flex items-center justify-center mt-0.5">
          {stageNumber}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-gray-900">
              {d.agentIcon ? `${d.agentIcon} ` : "🤖"}
              {d.agentName ?? "에이전트"}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${statusConfig.cls}`}
            >
              {statusConfig.label}
            </span>
            {duration && (
              <span className="text-[10px] text-gray-400 font-bold">⏱ {duration}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {wakeReason && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-bold">
                {WAKE_LABELS[wakeReason] ?? wakeReason}
              </span>
            )}
            <span className="text-[10px] text-gray-400">
              {d.startedAt ? formatTime(d.startedAt) : formatTime(event.createdAt)}
              {d.finishedAt ? ` → ${formatTime(d.finishedAt)}` : ""}
            </span>
          </div>
        </div>

        <div
          className={`text-gray-300 text-xs shrink-0 transition-transform ${
            isSelected ? "rotate-180" : ""
          }`}
        >
          ▼
        </div>
      </button>

      {/* Expanded RunTrace */}
      {isSelected && event.runId && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <RunTrace runId={event.runId} />
        </div>
      )}
    </div>
  );
}

export function IssueTimeline({ issueId }: IssueTimelineProps) {
  const [events, setEvents] = useState<TimelineEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getIssueTimeline(issueId)
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [issueId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <div className="text-4xl mb-4">📋</div>
        <div className="text-sm font-bold">타임라인 이벤트가 없습니다</div>
      </div>
    );
  }

  // Summary counts
  const runCount = events.filter((e) => e.type === "run").length;
  const commentCount = events.filter((e) => e.type === "comment").length;
  const approvalCount = events.filter((e) => e.type === "approval").length;

  // Render: interleave run stages with connector nodes
  let runIndex = 0;
  const nodes = events.map((event) => {
    if (event.type === "run") {
      runIndex++;
      const stageNum = runIndex;
      return (
        <RunStageCard
          key={event.id}
          event={event}
          stageNumber={stageNum}
          isSelected={selectedRunId === event.runId}
          onToggle={() =>
            setSelectedRunId(selectedRunId === event.runId ? null : event.runId)
          }
        />
      );
    }
    return <ConnectorNode key={event.id} event={event} />;
  });

  return (
    <div className="space-y-0">
      {/* Summary */}
      <div className="flex items-center gap-4 pb-4 mb-2 border-b border-gray-100">
        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
          파이프라인
        </span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-100 ring-1 ring-blue-300" />
          <span className="text-xs font-bold text-gray-500">{runCount} 실행</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="text-xs font-bold text-gray-500">{commentCount} 코멘트</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-bold text-gray-500">{approvalCount} 승인</span>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="space-y-1">{nodes}</div>
    </div>
  );
}
