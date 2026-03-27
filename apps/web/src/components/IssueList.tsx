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
        <div key={issue.id} className="flex items-center gap-3 py-3 px-2 hover:bg-gray-50 rounded">
          <span className="text-sm">{PRIORITY_ICONS[issue.priority] ?? "⚪"}</span>
          <span className="text-xs text-gray-400 font-mono w-20 shrink-0">
            {issue.identifier ?? "—"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center shrink-0 ${STATUS_COLORS[issue.status] ?? "bg-gray-100 text-gray-600"}`}
          >
            {issue.status.replace(/_/g, " ")}
          </span>
          <span className="text-sm text-gray-800 truncate flex-1">{issue.title}</span>
          {issue.agentName && (
            <span className="text-xs text-gray-500 shrink-0">
              {issue.agentIcon ?? "🤖"} {issue.agentName}
            </span>
          )}
          {issue.projectName && (
            <span className="text-xs text-gray-400 shrink-0">{issue.projectName}</span>
          )}
          <span className="text-xs text-gray-400 shrink-0">{timeAgo(issue.updatedAt)}</span>
        </div>
      ))}
    </div>
  );
}
