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

      {/* Current State Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-1">
              Current Status
            </h2>
            <p className="text-xs text-gray-500">현재 워크플로우 상태</p>
          </div>
          <button
            onClick={() => setShowDetailedTrace(!showDetailedTrace)}
            className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 rounded-lg transition-colors"
          >
            {showDetailedTrace ? "요약 보기" : "상세 보기"}
          </button>
        </div>

        {(() => {
          // 현재 단계 판별 (WorkflowStepper 로직과 동일)
          const hasImplementation = sessions.some(
            (s) => s.kind === "pull_request" || s.kind === "push_to_existing_pr" || s.pullRequestUrl
          );
          const hasReview = sessions.some((s) => s.approvalType && s.approvalStatus !== "pending");
          const hasCompletion = sessions.some((s) => s.kind === "completion" || s.status === "consumed");

          let currentStage = "계획";
          let currentStageIcon = "📋";
          if (hasCompletion) {
            currentStage = "완료";
            currentStageIcon = "✅";
          } else if (hasReview) {
            currentStage = "검토";
            currentStageIcon = "👀";
          } else if (hasImplementation) {
            currentStage = "구현";
            currentStageIcon = "⚙️";
          }

          // 최근 session (가장 최근 createdAt 기준)
          const recentSession = sessions.length > 0 ? sessions[0] : null;

          // approval 상태 집계
          const pendingApprovals = sessions.filter((s) => s.approvalStatus === "pending").length;
          const approvedApprovals = sessions.filter((s) => s.approvalStatus === "approved").length;
          const rejectedApprovals = sessions.filter((s) => s.approvalStatus === "rejected").length;

          return (
            <>
              {/* 현재 단계 및 최근 상태 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* 현재 단계 */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
                    Current Stage
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{currentStageIcon}</span>
                    <span className="text-2xl font-black text-gray-900">{currentStage}</span>
                  </div>
                </div>

                {/* 최근 Session 정보 */}
                {recentSession && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      Latest Activity
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{KIND_ICONS[recentSession.kind] ?? "📌"}</span>
                        <span className="text-sm font-bold text-gray-700">
                          {KIND_LABELS[recentSession.kind] ?? recentSession.kind}
                        </span>
                        <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_COLORS[recentSession.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {STATUS_LABELS[recentSession.status] ?? recentSession.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {formatTime(recentSession.createdAt)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Workflow 메타 정보 (branch, PR, commit, approval) */}
              {recentSession && (recentSession.branch || recentSession.pullRequestUrl || recentSession.commitSha || recentSession.approvalId) && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                    Workflow Details
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {recentSession.branch && (
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                          Branch
                        </span>
                        <div className="text-gray-900 font-semibold font-mono">{recentSession.branch}</div>
                      </div>
                    )}
                    {recentSession.commitSha && (
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                          Commit
                        </span>
                        <div className="text-gray-900 font-mono">{recentSession.commitSha.slice(0, 7)}</div>
                      </div>
                    )}
                    {recentSession.pullRequestUrl && (
                      <div className="col-span-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                          Pull Request
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 font-semibold">#{recentSession.pullRequestNumber}</span>
                          <a
                            href={recentSession.pullRequestUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 underline truncate"
                          >
                            {recentSession.pullRequestUrl}
                          </a>
                        </div>
                      </div>
                    )}
                    {recentSession.approvalId && (
                      <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-1">
                          Approval
                        </span>
                        <div className="text-gray-900 font-mono text-xs">{recentSession.approvalId.slice(0, 8)}</div>
                        {recentSession.approvalType && (
                          <div className="text-gray-600 text-[10px] mt-0.5">{recentSession.approvalType}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Session Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                    Total
                  </div>
                  <div className="text-lg font-black text-gray-900">{sessions.length}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                    Pending
                  </div>
                  <div className="text-lg font-black text-blue-700">{pendingApprovals}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">
                    Approved
                  </div>
                  <div className="text-lg font-black text-emerald-700">{approvedApprovals}</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <div className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">
                    Rejected
                  </div>
                  <div className="text-lg font-black text-red-700">{rejectedApprovals}</div>
                </div>
              </div>
            </>
          );
        })()}
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
