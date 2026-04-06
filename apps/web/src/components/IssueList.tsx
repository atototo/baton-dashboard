import { Link } from "react-router-dom";
import type { Issue } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-gray-100 text-gray-700",
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  done: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-50 border-red-200",
  high: "bg-orange-50 border-orange-200",
  medium: "bg-yellow-50 border-yellow-200",
  low: "bg-green-50 border-green-200",
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface IssueListProps {
  issues: Issue[];
}

export function IssueList({ issues }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 bg-white border rounded-xl shadow-sm">
        No issues found.
      </div>
    );
  }

  // Sort by priority, then by status (in_progress > in_review > others), then by updatedAt
  const sorted = [...issues].sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;

    const statusPriority: Record<string, number> = {
      in_progress: 0,
      in_review: 1,
      blocked: 2,
      todo: 3,
    };
    const statusDiff = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    if (statusDiff !== 0) return statusDiff;

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">
        {sorted.map((issue) => {
          const priorityHighlight = PRIORITY_COLORS[issue.priority];
          const isHighPriority = issue.priority === "urgent" || issue.priority === "high";

          return (
            <Link
              key={issue.id}
              to={`/issues/${issue.id}`}
              className={`flex items-center gap-4 py-4 px-6 hover:bg-gray-50 transition-all group border-l-4 ${
                priorityHighlight ? `border-l-current ${priorityHighlight}` : "border-l-transparent"
              }`}
            >
              <span className="text-lg shrink-0" title={`Priority: ${issue.priority}`}>
                {PRIORITY_ICONS[issue.priority] ?? "⚪"}
              </span>
              <div className="w-20 shrink-0">
                <span className={`text-xs font-black group-hover:text-blue-400 transition-colors font-mono tracking-tighter uppercase ${
                  isHighPriority ? "text-orange-600" : "text-gray-300"
                }`}>
                  {issue.identifier ?? "—"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-bold truncate group-hover:text-blue-600 transition-colors ${
                  isHighPriority ? "text-gray-900" : "text-gray-800"
                }`}>
                  {issue.title}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest ${STATUS_COLORS[issue.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {issue.status.replace(/_/g, " ")}
                </span>
                {issue.agentName && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded text-[11px] font-bold text-gray-600">
                    <span>{issue.agentIcon ?? "🤖"}</span>
                    <span className="truncate max-w-[80px]">{issue.agentName}</span>
                  </div>
                )}
                {issue.projectName && (
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter hidden md:block">
                    {issue.projectName}
                  </span>
                )}
                <span className="text-[10px] font-medium text-gray-400 w-16 text-right">
                  {timeAgo(issue.updatedAt)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
