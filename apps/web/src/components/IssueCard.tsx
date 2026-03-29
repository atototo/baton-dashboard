import { Link, useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import type { Issue } from "../lib/api.js";

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🟢",
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
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleCardClick = () => {
    // If it's a drag start, dnd-kit will handle it. 
    // If it's a simple click, we navigate.
    // Activation constraint in KanbanBoard (distance: 8) ensures this.
    navigate(`/issues/${issue.identifier || issue.id}`, { state: { issue } });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleCardClick}
      className={`block bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group text-left cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-50 ring-2 ring-blue-500 z-50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2 pointer-events-none">
        <Link
          to={`/issues/${issue.identifier || issue.id}`}
          state={{ issue }}
          className="text-xs font-mono font-bold text-gray-400 group-hover:text-blue-500 transition-colors pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {issue.identifier ?? `#${issue.issueNumber}`}
        </Link>
        <span className="text-xs" title={`Priority: ${issue.priority}`}>
          {PRIORITY_ICONS[issue.priority] ?? "⚪"}
        </span>
      </div>
      <div
        className="text-sm font-semibold text-gray-800 line-clamp-2 mb-3 group-hover:text-blue-600 transition-colors pointer-events-auto"
      >
        {issue.title}
      </div>
      <div className="flex items-center justify-between mt-auto pointer-events-none">
        {issue.agentName ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded text-[10px] font-bold text-gray-600">
            <span>{issue.agentIcon ?? "🤖"}</span>
            <span className="truncate max-w-[80px]">{issue.agentName}</span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 font-medium italic">Unassigned</span>
        )}
        <span className="text-[10px] text-gray-400 font-medium">
          {new Date(issue.updatedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
