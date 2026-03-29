import { Link, useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import type { Issue } from "../lib/api.js";

const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-green-400",
};

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: issue.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const handleCardClick = () => {
    navigate(`/issues/${issue.identifier || issue.id}`, { state: { issue } });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleCardClick}
      className={`bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 ring-2 ring-blue-400 z-50" : ""
      }`}
    >
      {/* Identifier + priority dot */}
      <div className="flex items-center justify-between gap-1 mb-1 pointer-events-none">
        <Link
          to={`/issues/${issue.identifier || issue.id}`}
          state={{ issue }}
          className="text-[10px] font-mono font-bold text-gray-400 hover:text-blue-500 transition-colors pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {issue.identifier ?? `#${issue.issueNumber}`}
        </Link>
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[issue.priority] ?? "bg-gray-300"}`} title={issue.priority} />
      </div>

      {/* Title */}
      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug mb-1.5 pointer-events-none">
        {issue.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pointer-events-none">
        {issue.agentName ? (
          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-500 truncate max-w-[80%]">
            <span>{issue.agentIcon ?? "🤖"}</span>
            <span className="truncate">{issue.agentName}</span>
          </div>
        ) : (
          <span className="text-[9px] text-gray-300 italic">Unassigned</span>
        )}
        <span className="text-[9px] text-gray-300 font-mono shrink-0">
          {new Date(issue.updatedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
        </span>
      </div>
    </div>
  );
}
