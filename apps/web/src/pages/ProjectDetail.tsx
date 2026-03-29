import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useQuery } from "../hooks/useQuery.js";
import { KanbanBoard } from "../components/KanbanBoard.js";
import { IssueList } from "../components/IssueList.js";

const STATUS_STYLE: Record<string, string> = {
  backlog: "text-gray-600 bg-gray-50 border-gray-200",
  todo: "text-gray-600 bg-gray-50 border-gray-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  in_review: "text-yellow-600 bg-yellow-50 border-yellow-200",
  active: "text-green-600 bg-green-50 border-green-200",
  done: "text-green-600 bg-green-50 border-green-200",
  completed: "text-green-600 bg-green-50 border-green-200",
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "issues", label: "Issues" },
  { key: "agents", label: "Agents" },
  { key: "timeline", label: "Timeline" },
  { key: "settings", label: "Settings" },
];

export function ProjectDetail() {
  const { id, tab } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  
  const activeTab = tab || "issues";

  const project = useQuery(() => (id ? api.getProject(id) : Promise.reject("No ID")), [id]);
  const issues = useQuery(() => (id ? api.getIssues({ projectId: id }) : Promise.reject("No ID")), [id]);
  const stats = useQuery(() => (id ? api.getProjectStats(id) : Promise.reject("No ID")), [id]);

  const leadAgent = useQuery(
    () => (project.data?.leadAgentId ? api.getAgent(project.data.leadAgentId) : Promise.reject("No lead agent")),
    [project.data?.leadAgentId]
  );

  useEffect(() => {
    if (!tab && id) {
      // Optional: default to issues tab if no tab is specified
      // navigate(`/projects/${id}/issues`, { replace: true });
    }
  }, [tab, id, navigate]);

  if (!id) return <div className="p-8 text-red-500 font-bold">Project ID is missing.</div>;

  const currentLeadAgentName = leadAgent.data?.name ?? project.data?.leadAgentName;
  const currentLeadAgentIcon = leadAgent.data?.icon ?? project.data?.leadAgentIcon;

  const handleRefresh = () => {
    issues.refetch();
    stats.refetch();
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "issues":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  {viewMode === "kanban" ? "Kanban Board" : "Issue List"}
                  {issues.data && (
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {issues.data.length} Issues
                    </span>
                  )}
                </h2>
                <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode("kanban")}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                      viewMode === "kanban" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Kanban
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${
                      viewMode === "list" ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    List
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  className="text-xs font-bold text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 bg-white transition-all"
                >
                  Refresh
                </button>
              </div>
            </div>

            {issues.loading ? (
              <div className="flex gap-6 overflow-x-auto pb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-72 h-96 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : issues.error ? (
              <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-red-600 font-medium text-center">
                Error loading issues: {issues.error}
              </div>
            ) : issues.data && issues.data.length > 0 ? (
              viewMode === "kanban" ? (
                <KanbanBoard 
                  issues={issues.data} 
                  stats={stats.data ?? undefined} 
                  onRefresh={handleRefresh}
                />
              ) : (
                <IssueList issues={issues.data} />
              )
            ) : (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                <div className="max-w-sm mx-auto space-y-4">
                  <div className="text-4xl">🗒️️</div>
                  <h3 className="text-lg font-black text-gray-900">No issues in {project.data?.name} yet</h3>
                  <p className="text-sm text-gray-500 font-medium">
                    This project doesn't have any issues. Create the first one to get started!
                  </p>
                  <button className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                    Create First Issue
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      case "overview":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Project Overview</h3>
              <p className="text-gray-600 leading-relaxed">
                {project.data?.description || "No description provided."}
              </p>
            </div>
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Total Issues</span>
                  <span className="text-lg font-black text-gray-900">{stats.data?.total ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Target Date</span>
                  <span className="text-sm font-bold text-gray-900">
                    {project.data?.targetDate ? new Date(project.data.targetDate).toLocaleDateString() : "TBD"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="p-12 text-center bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
            <span className="text-sm text-gray-400 font-medium italic">
              {TABS.find(t => t.key === activeTab)?.label} section is under development.
            </span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/projects" className="hover:text-blue-600 transition-colors">Projects</Link>
          <span>/</span>
          <span className="font-medium text-gray-900 truncate">
            {project.data?.name ?? "Loading..."}
          </span>
        </div>

        {project.loading ? (
          <div className="h-32 bg-white border border-gray-100 rounded-2xl animate-pulse" />
        ) : project.error ? (
          <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-medium">
            Error loading project: {project.error}
          </div>
        ) : project.data ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="w-4 h-4 rounded-full border border-black/5 shrink-0"
                    style={{ backgroundColor: project.data.color ?? "#94a3b8" }}
                  />
                  <h1 className="text-2xl font-black text-gray-900 truncate tracking-tight">
                    {project.data.name}
                  </h1>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full border font-black uppercase tracking-widest ${
                      STATUS_STYLE[project.data.status] ?? "text-gray-500 bg-gray-50 border-gray-200"
                    }`}
                  >
                    {project.data.status}
                  </span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
                  {project.data.description ?? "No description available."}
                </p>
              </div>

              <div className="flex items-center gap-8 shrink-0">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lead Agent</span>
                  {currentLeadAgentName ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                      <span className="text-lg">{currentLeadAgentIcon ?? "🤖"}</span>
                      <span className="text-sm font-bold text-gray-700">
                        {currentLeadAgentName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 font-medium italic">Unassigned</span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Issues</span>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-1.5 pr-2 border-r border-gray-200">
                      <span className="text-xs font-black text-gray-900">{stats.data?.total ?? 0}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Total</span>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      {["backlog", "todo", "in_progress", "blocked", "in_review", "done", "cancelled"].map((status) => {
                        const count = stats.data?.byStatus?.[status] ?? 0;
                        return (
                          <div key={status} className="flex items-center gap-1" title={status.toUpperCase()}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              status === "done" || status === "completed" ? "bg-green-500" :
                              status === "in_progress" ? "bg-blue-500" :
                              status === "in_review" ? "bg-yellow-500" : 
                              status === "blocked" ? "bg-orange-500" :
                              status === "cancelled" ? "bg-red-500" : "bg-gray-300"
                            }`} />
                            <span className="text-xs font-black text-gray-700">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Date</span>
                  <div className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                    <span className="text-sm font-bold text-gray-700">
                      {project.data.targetDate
                        ? new Date(project.data.targetDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : "No target date"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/projects/${id}/${t.key}`}
            className={`px-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-300 hover:text-gray-500 hover:border-gray-200"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderTabContent()}
      </div>
    </div>
  );
}
