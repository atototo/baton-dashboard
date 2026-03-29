import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useQuery } from "../hooks/useQuery.js";
import { useCompany } from "../context/CompanyContext.js";

const STATUS_STYLE: Record<string, string> = {
  backlog: "text-gray-600 bg-gray-50 border-gray-200",
  active: "text-green-600 bg-green-50 border-green-200",
  in_progress: "text-blue-600 bg-blue-50 border-blue-200",
  in_review: "text-yellow-600 bg-yellow-50 border-yellow-200",
  done: "text-green-600 bg-green-50 border-green-200",
  completed: "text-green-600 bg-green-50 border-green-200",
};

export function ProjectList() {
  const { selectedCompanyId } = useCompany();

  const projects = useQuery(
    () => api.getProjects(selectedCompanyId || undefined),
    [selectedCompanyId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => projects.refetch()}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 bg-white"
        >
          Refresh
        </button>
      </div>

      {projects.loading ? (
        <div className="text-gray-400 text-sm">Loading projects...</div>
      ) : projects.error ? (
        <div className="text-red-500 text-sm">Error: {projects.error}</div>
      ) : projects.data ? (
        projects.data.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            등록된 프로젝트가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.data.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:border-indigo-300 transition-colors group shadow-xs"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: project.color ?? "#94a3b8" }}
                    />
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      STATUS_STYLE[project.status] ?? "text-gray-500 bg-gray-50 border-gray-200"
                    }`}
                  >
                    {project.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="text-xs text-gray-400">Lead Agent:</span>
                  {project.leadAgentName ? (
                    <div className="flex items-center gap-1">
                      <span>{project.leadAgentIcon ?? "🤖"}</span>
                      <span className="text-gray-700 font-medium">
                        {project.leadAgentName}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">미배정</span>
                  )}
                </div>

                <p className="mt-3 text-sm text-gray-400 line-clamp-2">
                  {project.description ?? "프로젝트 설명이 없습니다."}
                </p>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
