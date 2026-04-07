import { FileText, Wrench, Eye, CheckCircle2 } from "lucide-react";
import type { WorkflowSession } from "../lib/api";

export type FlowStage = "plan" | "implementation" | "review" | "complete";

interface WorkflowStepperProps {
  sessions: WorkflowSession[];
}

interface StageInfo {
  stage: FlowStage;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  completed: boolean;
  current: boolean;
  hasRevision: boolean;
  isStale: boolean;
}

// session 데이터를 flow 단계로 매핑
function deriveFlowStages(sessions: WorkflowSession[]): StageInfo[] {
  const hasPlan = sessions.some((s) => s.kind === "plan");
  const hasImplementation = sessions.some(
    (s) => s.kind === "pull_request" || s.kind === "push_to_existing_pr" || s.pullRequestUrl
  );
  const hasReview = sessions.some((s) => s.approvalType && s.approvalStatus !== "pending");
  const hasCompletion = sessions.some((s) => s.kind === "completion" || s.status === "consumed");

  const planSessions = sessions.filter((s) => s.kind === "plan");
  const implSessions = sessions.filter((s) => s.kind === "pull_request" || s.kind === "push_to_existing_pr");
  const reviewSessions = sessions.filter((s) => s.approvalType);
  const completionSessions = sessions.filter((s) => s.kind === "completion");

  // 현재 단계 결정
  let currentStage: FlowStage = "plan";
  if (hasCompletion) {
    currentStage = "complete";
  } else if (hasReview) {
    currentStage = "review";
  } else if (hasImplementation) {
    currentStage = "implementation";
  } else if (hasPlan) {
    currentStage = "plan";
  }

  const stages: StageInfo[] = [
    {
      stage: "plan",
      label: "계획",
      Icon: FileText,
      completed: hasPlan && (hasImplementation || hasReview || hasCompletion),
      current: currentStage === "plan",
      hasRevision: planSessions.some((s) => s.revision),
      isStale: planSessions.some((s) => s.stale),
    },
    {
      stage: "implementation",
      label: "구현",
      Icon: Wrench,
      completed: hasImplementation && (hasReview || hasCompletion),
      current: currentStage === "implementation",
      hasRevision: implSessions.some((s) => s.revision),
      isStale: implSessions.some((s) => s.stale),
    },
    {
      stage: "review",
      label: "검토",
      Icon: Eye,
      completed: hasReview && hasCompletion,
      current: currentStage === "review",
      hasRevision: reviewSessions.some((s) => s.revision),
      isStale: reviewSessions.some((s) => s.stale),
    },
    {
      stage: "complete",
      label: "완료",
      Icon: CheckCircle2,
      completed: hasCompletion,
      current: currentStage === "complete",
      hasRevision: completionSessions.some((s) => s.revision),
      isStale: completionSessions.some((s) => s.stale),
    },
  ];

  return stages;
}

export function WorkflowStepper({ sessions }: WorkflowStepperProps) {
  const stages = deriveFlowStages(sessions);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-6">
      <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
        Workflow Progress
      </h2>

      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-0" style={{ left: '2rem', right: '2rem' }} />

        {stages.map((stage) => {
          const isActive = stage.current || stage.completed;
          const { Icon } = stage;

          return (
            <div key={stage.stage} className="flex-1 flex flex-col items-center relative z-10">
              {/* Step circle */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all mb-3 ${
                  stage.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : stage.current
                    ? "bg-blue-500 border-blue-500 text-white animate-pulse"
                    : "bg-white border-gray-300 text-gray-400"
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Stage label */}
              <div className="text-center">
                <div
                  className={`text-xs font-bold mb-1 ${
                    isActive ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {stage.label}
                </div>

                {/* Status indicators */}
                <div className="flex items-center justify-center gap-1">
                  {stage.hasRevision && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      재검토
                    </span>
                  )}
                  {stage.isStale && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                      만료
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
