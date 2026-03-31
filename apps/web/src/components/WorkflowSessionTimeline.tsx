import { useEffect, useState } from "react";
import { api, type WorkflowSession } from "../lib/api";
import { WorkflowStepper } from "./WorkflowStepper";

interface WorkflowSessionTimelineProps {
  issueId: string;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString("ko-KR", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

// 한글 번역 매핑
const STATUS_LABELS: Record<string, string> = {
  consumed: "완료됨",
  stale: "만료됨",
  revision: "재검토",
  pending: "대기 중",
  approved: "승인됨",
  rejected: "거부됨",
};

const STATUS_COLORS: Record<string, string> = {
  consumed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  stale: "bg-amber-50 text-amber-700 border-amber-200",
  revision: "bg-purple-50 text-purple-700 border-purple-200",
  pending: "bg-gray-50 text-gray-600 border-gray-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const KIND_LABELS: Record<string, string> = {
  plan: "계획",
  pull_request: "PR 생성",
  push_to_existing_pr: "PR 업데이트",
  completion: "완료",
  question: "질문",
  approval: "승인",
};

const KIND_ICONS: Record<string, string> = {
  plan: "📋",
  pull_request: "🔀",
  push_to_existing_pr: "⬆️",
  completion: "✅",
  question: "❓",
  approval: "👍",
};

function SessionCard({ session }: { session: WorkflowSession }) {
  const statusColor = STATUS_COLORS[session.status] ?? "bg-gray-50 text-gray-600 border-gray-200";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;
  const kindIcon = KIND_ICONS[session.kind] ?? "📌";
  const kindLabel = KIND_LABELS[session.kind] ?? session.kind;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: Epoch + Kind + Status */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{kindIcon}</span>
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Round {session.epoch}
          </span>
        </div>
        <span className="text-xs text-gray-300">•</span>
        <span className="text-xs font-bold text-gray-700">{kindLabel}</span>
        <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* State Flags */}
      <div className="flex items-center gap-2 mb-3">
        {session.stale && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
            STALE
          </span>
        )}
        {session.revision && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
            REVISION
          </span>
        )}
        {session.consumed && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
            CONSUMED
          </span>
        )}
      </div>

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Approval Info */}
        {session.approvalId && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Approval</span>
            <div className="text-gray-700 font-mono truncate">{session.approvalId.slice(0, 8)}</div>
          </div>
        )}

        {/* Approval Type */}
        {session.approvalType && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Type</span>
            <div className="text-gray-700 font-semibold">{session.approvalType}</div>
          </div>
        )}

        {/* Commit SHA */}
        {session.commitSha && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Commit</span>
            <div className="text-gray-700 font-mono truncate">{session.commitSha.slice(0, 7)}</div>
          </div>
        )}

        {/* Branch */}
        {session.branch && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Branch</span>
            <div className="text-gray-700 font-semibold">{session.branch}</div>
          </div>
        )}

        {/* PR Info */}
        {session.pullRequestUrl && (
          <div className="col-span-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pull Request</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-semibold">#{session.pullRequestNumber}</span>
              <a
                href={session.pullRequestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 underline truncate"
              >
                {session.pullRequestUrl}
              </a>
            </div>
          </div>
        )}

        {/* Run Info */}
        {session.runId && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Run</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-700 font-mono truncate">{session.runId.slice(0, 8)}</span>
              {session.runStatus && (
                <span className="text-[10px] font-bold text-gray-500 uppercase">{session.runStatus}</span>
              )}
            </div>
          </div>
        )}

        {/* Run Count */}
        {session.runCount > 0 && (
          <div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Run Count</span>
            <div className="text-gray-700 font-bold">{session.runCount}</div>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-gray-400 font-medium">Created:</span>
          <span className="text-gray-700 font-mono ml-1">{formatTime(session.createdAt)}</span>
        </div>
        {session.decidedAt && (
          <div>
            <span className="text-gray-400 font-medium">Decided:</span>
            <span className="text-gray-700 font-mono ml-1">{formatTime(session.decidedAt)}</span>
          </div>
        )}
      </div>

      {/* Decision Note */}
      {session.decisionNote && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">Decision Note</span>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{session.decisionNote}</p>
        </div>
      )}
    </div>
  );
}

export function WorkflowSessionTimeline({ issueId }: WorkflowSessionTimelineProps) {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedTrace, setShowDetailedTrace] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getIssueWorkflowSessions(issueId);
        setSessions(data);
      } catch (err) {
        console.error("Failed to load workflow sessions:", err);
        setError("워크플로우 세션을 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [issueId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Sessions</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm font-bold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-sm font-black text-gray-900 mb-2 uppercase tracking-tight">No Workflow Sessions</h3>
          <p className="text-xs text-gray-500">이 이슈에는 아직 워크플로우 세션이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Workflow Stepper - 현재 단계 시각화 */}
      <WorkflowStepper sessions={sessions} />

      {/* Summary Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">
              Workflow Sessions ({sessions.length})
            </h2>
            <p className="text-xs text-gray-500">워크플로우 진행 이력 요약</p>
          </div>
          <button
            onClick={() => setShowDetailedTrace(!showDetailedTrace)}
            className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors"
          >
            {showDetailedTrace ? "요약 보기" : "상세 보기"}
          </button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
              Total Sessions
            </div>
            <div className="text-xl font-black text-gray-900">{sessions.length}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
            <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
              Completed
            </div>
            <div className="text-xl font-black text-emerald-700">
              {sessions.filter((s) => s.status === "consumed").length}
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">
              Stale
            </div>
            <div className="text-xl font-black text-amber-700">
              {sessions.filter((s) => s.stale).length}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
            <div className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">
              Revisions
            </div>
            <div className="text-xl font-black text-purple-700">
              {sessions.filter((s) => s.revision).length}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Trace (conditional) */}
      {showDetailedTrace && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Detailed Trace
            </span>
            <span className="text-xs text-gray-500">최신 세션부터 표시됩니다</span>
          </div>
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
