import { useDroppable } from "@dnd-kit/core";
import type { Issue } from "../lib/api.js";
import { IssueCard } from "./IssueCard.js";

interface KanbanColumnProps {
  title: string;
  status: string;
  issues: Issue[];
  count?: number;
}

const COLUMN_COLORS: Record<string, string> = {
  backlog: "bg-gray-100 border-gray-200",
  todo: "bg-gray-50 border-gray-200",
  in_progress: "bg-blue-50/50 border-blue-100",
  in_review: "bg-yellow-50/50 border-yellow-100",
  blocked: "bg-orange-50/50 border-orange-100",
  done: "bg-green-50/50 border-green-100",
  cancelled: "bg-red-50/50 border-red-100",
};

const TITLE_COLORS: Record<string, string> = {
  backlog: "text-gray-500",
  todo: "text-gray-600",
  in_progress: "text-blue-600",
  in_review: "text-yellow-600",
  blocked: "text-orange-600",
  done: "text-green-600",
  cancelled: "text-red-600",
};

export function KanbanColumn({ title, status, issues, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const displayCount = count !== undefined ? count : issues.length;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-72 shrink-0 rounded-xl border p-3 transition-colors ${
        isOver ? "bg-blue-100/30 border-blue-400 border-dashed" : (COLUMN_COLORS[status] ?? "bg-gray-50 border-gray-200")
      }`}
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className={`text-sm font-black uppercase tracking-widest ${TITLE_COLORS[status] ?? "text-gray-600"}`}>
          {title}
        </h3>
        <span className="text-xs font-bold text-gray-400 bg-white/50 px-2 py-0.5 rounded-full border border-gray-100">
          {displayCount}
        </span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-hide">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {issues.length === 0 && (
          <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg bg-white/30">
            <span className="text-xs text-gray-400 font-medium">No issues</span>
          </div>
        )}
      </div>
    </div>
  );
}
