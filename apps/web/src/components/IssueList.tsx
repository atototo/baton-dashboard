import type { Issue } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
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
      <div className="text-center py-12 text-gray-400">
        No issues yet. Create one in Baton to see it here.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {issues.map((issue) => (
        <div key={issue.id} className="grid grid-cols-[32px_100px_100px_1fr_150px_150px_100px] gap-3 items-center py-4 px-4 hover:bg-gray-50 transition-colors group">
          <span className="text-sm text-center">{PRIORITY_ICONS[issue.priority] ?? "⚪"}</span>
          <span className="text-xs text-gray-400 font-mono">
            {issue.identifier ?? "—"}
          </span>
          <div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-tight inline-block w-full text-center ${STATUS_COLORS[issue.status] ?? "bg-gray-100 text-gray-600"}`}
            >
              {issue.status.replace(/_/g, " ")}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{issue.title}</span>
          <div className="truncate">
            {issue.agentName ? (
              <span className="text-xs text-gray-600 flex items-center gap-1.5">
                <span className="text-sm">{issue.agentIcon ?? "🤖"}</span>
                {issue.agentName}
              </span>
            ) : (
              <span className="text-xs text-gray-300 italic">Unassigned</span>
            )}
          </div>
          <div className="truncate">
            {issue.projectName ? (
              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{issue.projectName}</span>
            ) : (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
          <span className="text-xs text-gray-400 text-right">{timeAgo(issue.updatedAt)}</span>
        </div>
      ))}
    </div>
  );
}
