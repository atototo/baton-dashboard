import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { api, type Issue, type ProjectStats } from "../lib/api.js";
import { KanbanColumn } from "./KanbanColumn.js";

interface KanbanBoardProps {
  issues: Issue[];
  stats?: ProjectStats;
  onRefresh?: () => void;
}
const COLUMNS = [
  { key: "backlog", title: "Backlog" },
  { key: "todo", title: "To Do" },
  { key: "in_progress", title: "In Progress" },
  { key: "in_review", title: "In Review" },
  { key: "blocked", title: "Blocked" },
  { key: "done", title: "Done" },
  { key: "cancelled", title: "Cancelled" },
];

export function KanbanBoard({ issues, stats, onRefresh }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getIssuesByStatus = (status: string) => {
    return issues.filter((issue) => issue.status === status);
  };

  const getCountByStatus = (status: string) => {
    if (!stats?.byStatus) return undefined;
    return stats.byStatus[status] ?? 0;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const newStatus = over.id as string;

    const issue = issues.find((i) => i.id === issueId);
    if (issue && issue.status !== newStatus) {
      try {
        await api.updateIssue(issueId, { status: newStatus });
        onRefresh?.();
      } catch (error) {
        console.error("Failed to update issue status:", error);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.key}
            title={col.title}
            status={col.key}
            issues={getIssuesByStatus(col.key)}
            count={getCountByStatus(col.key)}
          />
        ))}
      </div>
    </DndContext>
  );
}
