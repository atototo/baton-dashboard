import { useEffect, useState } from "react";
import {
  FileText, GitPullRequest, ArrowUp, CheckCircle,
  HelpCircle, ThumbsUp, AlertCircle, Loader2,
  ChevronDown, ChevronRight, TrendingUp, Archive, RotateCcw
} from "lucide-react";
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

function getKindIcon(kind: string) {
  switch (kind) {
    case "plan":
      return FileText;
    case "pull_request":
      return GitPullRequest;
    case "push_to_existing_pr":
      return ArrowUp;
    case "completion":
      return CheckCircle;
    case "question":
      return HelpCircle;
    case "approval":
      return ThumbsUp;
    default:
      return FileText;
  }
}

function RoundDetailPanel({ session }: { session: WorkflowSession }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    plan: true,
    revision: false,
    diff: false,
    diagnostics: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">
        Round {session.epoch} 상세
      </h3>

      {/* Canonical Plan */}
      {session.canonicalPlan && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("plan")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Canonical Plan
              </span>
              <span className="text-xs text-gray-500">
                (source: {session.canonicalPlan.source})
              </span>
            </div>
            {expandedSections.plan ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          {expandedSections.plan && (
            <div className="p-4 bg-white">
              <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">
                {session.canonicalPlan.text}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Revision History */}
      {session.revisionHistory.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("revision")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Revision History
              </span>
              <span className="text-xs text-gray-500">
                ({session.revisionHistory.length})
              </span>
            </div>
            {expandedSections.revision ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          {expandedSections.revision && (
            <div className="p-4 bg-white space-y-3">
              {session.revisionHistory.map((entry) => (
                <div key={entry.approvalId} className="border-l-2 border-purple-200 pl-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-purple-700">
                      {entry.kind === "revision_requested" ? "수정 요청" : entry.kind === "approved" ? "승인됨" : "제출됨"}
                    </span>
                    <span className="text-xs text-gray-500">{formatTime(entry.createdAt)}</span>
                  </div>
                  {entry.summary && (
                    <p className="text-xs text-gray-600 leading-relaxed">{entry.summary}</p>
                  )}
                  {entry.decisionNote && (
                    <p className="text-xs text-gray-500 mt-1 italic">{entry.decisionNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diff Metadata */}
      {session.diff.available && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("diff")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Diff / PR
              </span>
            </div>
            {expandedSections.diff ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          {expandedSections.diff && (
            <div className="p-4 bg-white space-y-2 text-xs">
              {session.diff.branch && (
                <div>
                  <span className="text-gray-500 font-medium">Branch:</span>
                  <span className="text-gray-700 font-semibold ml-2">{session.diff.branch}</span>
                </div>
              )}
              {session.diff.baseBranch && (
                <div>
                  <span className="text-gray-500 font-medium">Base:</span>
                  <span className="text-gray-700 font-semibold ml-2">{session.diff.baseBranch}</span>
                </div>
              )}
              {session.diff.commitSha && (
                <div>
                  <span className="text-gray-500 font-medium">Commit:</span>
                  <span className="text-gray-700 font-mono ml-2">{session.diff.commitSha.slice(0, 7)}</span>
                </div>
              )}
              {session.diff.pullRequestUrl && (
                <div>
                  <span className="text-gray-500 font-medium">PR:</span>
                  <a
                    href={session.diff.pullRequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline ml-2"
                  >
                    #{session.diff.pullRequestNumber}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Context Diagnostics */}
      {session.contextDiagnostics.signals.length > 0 && (
        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection("diagnostics")}
            className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Context Diagnostics
              </span>
              <span className="text-xs text-gray-500">
                ({session.contextDiagnostics.signals.length} signals)
              </span>
            </div>
            {expandedSections.diagnostics ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
          {expandedSections.diagnostics && (
            <div className="p-4 bg-white space-y-2">
              {session.contextDiagnostics.signals.map((signal) => (
                <div key={signal.key} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">{signal.label}</span>
                  <span className="text-gray-600">
                    {signal.key === "high_pressure"
                      ? `${(signal.value * 100).toFixed(1)}%`
                      : signal.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Decision Note */}
      {session.decisionNote && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-2">
            Decision Note
          </span>
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
            {session.decisionNote}
          </p>
        </div>
      )}
    </div>
  );
}

function RoundCard({
  session,
  isSelected,
  onSelect
}: {
  session: WorkflowSession;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusColor = STATUS_COLORS[session.status] ?? "bg-gray-50 text-gray-600 border-gray-200";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;
  const KindIcon = getKindIcon(session.kind);
  const kindLabel = KIND_LABELS[session.kind] ?? session.kind;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-white border rounded-lg p-4 transition-all ${
        isSelected
          ? "border-blue-500 shadow-md ring-2 ring-blue-200"
          : "border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <KindIcon className="w-4 h-4 text-gray-600" />
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

      {/* State Flags & Diagnostics Signals */}
      <div className="flex items-center gap-2 flex-wrap">
        {session.stale && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
            <Archive className="w-3 h-3" />
            STALE
          </span>
        )}
        {session.revision && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            REVISION
          </span>
        )}
        {session.consumed && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            CONSUMED
          </span>
        )}
        {session.contextDiagnostics.signals.map((signal) => (
          <span
            key={signal.key}
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200"
          >
            {signal.label}
          </span>
        ))}
      </div>

      {/* Quick Info */}
      {session.canonicalPlan && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
          <FileText className="w-3 h-3" />
          <span>Plan available</span>
        </div>
      )}
    </button>
  );
}

export function WorkflowSessionTimeline({ issueId }: WorkflowSessionTimelineProps) {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getIssueWorkflowSessions(issueId);
        setSessions(data);
        // Auto-select the latest round
        if (data.length > 0) {
          setSelectedRoundId(data[0].id);
        }
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
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Sessions</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-sm font-black text-gray-900 mb-2 uppercase tracking-tight">No Workflow Sessions</h3>
          <p className="text-xs text-gray-500">이 이슈에는 아직 워크플로우 세션이 없습니다.</p>
        </div>
      </div>
    );
  }

  const selectedSession = sessions.find((s) => s.id === selectedRoundId);

  return (
    <div className="space-y-6">
      {/* Workflow Stepper - 현재 단계 시각화 */}
      <WorkflowStepper sessions={sessions} />

      {/* Summary Stats */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4">
          Workflow Sessions ({sessions.length})
        </h2>

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

      {/* Round Cards */}
      <div>
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">
          Round 목록 (최신순)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <RoundCard
              key={session.id}
              session={session}
              isSelected={session.id === selectedRoundId}
              onSelect={() => setSelectedRoundId(session.id)}
            />
          ))}
        </div>
      </div>

      {/* Round Detail Panel */}
      {selectedSession && (
        <div>
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 px-2">
            선택된 Round 상세
          </h3>
          <RoundDetailPanel session={selectedSession} />
        </div>
      )}
    </div>
  );
}
