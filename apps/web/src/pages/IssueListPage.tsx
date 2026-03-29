import { useState } from "react";
import { api } from "../lib/api.js";
import { useQuery } from "../hooks/useQuery.js";
import { IssueList } from "../components/IssueList.js";
import { KanbanBoard } from "../components/KanbanBoard.js";
import { useCompany } from "../context/CompanyContext.js";

export function IssueListPage() {
  const { selectedCompanyId } = useCompany();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const issues = useQuery(
    () => api.getIssues({
      ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      limit: "100"
    }),
    [selectedCompanyId, statusFilter]
  );

  const handleRefresh = () => {
    issues.refetch();
  };

  const isBoard = viewMode === "kanban";

  return (
    <div className={`flex flex-col ${isBoard ? "-mx-8 -my-6 h-[calc(100vh-0px)] overflow-hidden" : "space-y-6"}`}>
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 ${isBoard ? "px-8 pt-6 pb-3" : ""}`}>
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Issues</h1>
          <p className="text-sm text-gray-500 font-medium">Manage and track all issues across projects.</p>
        </div>

        <div className="flex items-center gap-3">
          {!isBoard && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </select>
          )}

          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                viewMode === "kanban" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Board
            </button>
          </div>

          <button
            onClick={handleRefresh}
            className="p-2 text-gray-400 hover:text-gray-900 bg-white border border-gray-200 rounded-lg transition-all"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Content */}
      {issues.loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Issues</span>
        </div>
      ) : issues.error ? (
        <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-medium text-center">
          Error loading issues: {issues.error}
        </div>
      ) : issues.data ? (
        isBoard ? (
          <div className="flex-1 min-h-0 px-8 pb-4 overflow-hidden">
            <KanbanBoard issues={issues.data} onRefresh={handleRefresh} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <IssueList issues={issues.data} />
          </div>
        )
      ) : null}
    </div>
  );
}
