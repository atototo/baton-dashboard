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
  backlog: "bg-gray-50 border-gray-200",
  todo: "bg-gray-50 border-gray-200",
  in_progress: "bg-blue-50/40 border-blue-100",
  in_review: "bg-yellow-50/40 border-yellow-100",
  blocked: "bg-orange-50/40 border-orange-100",
  done: "bg-green-50/40 border-green-100",
  cancelled: "bg-red-50/30 border-red-100",
};

const TITLE_COLORS: Record<string, string> = {
  backlog: "text-gray-500",
  todo: "text-gray-600",
  in_progress: "text-blue-600",
  in_review: "text-yellow-600",
  blocked: "text-orange-600",
  done: "text-green-600",
  cancelled: "text-red-500",
};

const DOT_COLORS: Record<string, string> = {
  backlog: "bg-gray-300",
  todo: "bg-gray-400",
  in_progress: "bg-blue-500",
  in_review: "bg-yellow-500",
  blocked: "bg-orange-500",
  done: "bg-green-500",
  cancelled: "bg-red-400",
};

export function KanbanColumn({ title, status, issues, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const displayCount = count !== undefined ? count : issues.length;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[130px] rounded-xl border p-2 transition-colors ${
        isOver
          ? "bg-blue-50 border-blue-300 border-dashed"
          : (COLUMN_COLORS[status] ?? "bg-gray-50 border-gray-200")
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_COLORS[status] ?? "bg-gray-300"}`} />
        <h3 className={`text-[10px] font-black uppercase tracking-widest truncate flex-1 ${TITLE_COLORS[status] ?? "text-gray-600"}`}>
          {title}
        </h3>
        <span className="text-[10px] font-bold text-gray-400 shrink-0">{displayCount}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {issues.length === 0 && (
          <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg bg-white/40">
            <span className="text-[10px] text-gray-300 font-medium">No issues</span>
          </div>
        )}
      </div>
    </div>
  );
}
