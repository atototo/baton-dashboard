import { api } from "../lib/api.js";
import { useQuery } from "../hooks/useQuery.js";
import { StatCard } from "../components/StatCard.js";
import { IssueList } from "../components/IssueList.js";
import { AgentList } from "../components/AgentList.js";
import { useCompany } from "../context/CompanyContext.js";

export function DashboardHome() {
  const { selectedCompanyId } = useCompany();

  const stats = useQuery(
    () => api.getOverview(selectedCompanyId || undefined),
    [selectedCompanyId]
  );
  const issues = useQuery(
    () => api.getIssues({ 
      limit: "20", 
      ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}) 
    }),
    [selectedCompanyId]
  );
  const agents = useQuery(
    () => api.getAgents(selectedCompanyId || undefined),
    [selectedCompanyId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={() => {
            stats.refetch();
            issues.refetch();
            agents.refetch();
          }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 bg-white"
        >
          Refresh
        </button>
      </div>

      {stats.loading ? (
        <div className="text-gray-400 text-sm">Loading stats...</div>
      ) : stats.error ? (
        <div className="text-red-500 text-sm">Error: {stats.error}</div>
      ) : stats.data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="In Progress"
              value={stats.data.issues.inProgress}
              color="text-blue-600"
              icon="⚡"
              highlight={stats.data.issues.inProgress > 10}
              subtitle={stats.data.issues.inProgress > 10 ? "High load" : "Active work"}
            />
            <StatCard
              label="In Review"
              value={stats.data.issues.inReview}
              color="text-yellow-600"
              icon="👁️"
              highlight={stats.data.issues.inReview > 5}
              subtitle={stats.data.issues.inReview > 5 ? "Needs attention" : "Pending review"}
            />
            <StatCard
              label="Backlog"
              value={stats.data.issues.backlog}
              color="text-gray-600"
              icon="📋"
              subtitle="Waiting to start"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total Issues"
              value={stats.data.issues.total}
              color="text-gray-900"
              icon="📊"
            />
            <StatCard
              label="Done"
              value={stats.data.issues.done}
              color="text-green-600"
              icon="✅"
            />
            <StatCard
              label="Agents"
              value={stats.data.agents.total}
              color="text-purple-600"
              icon="🤖"
              subtitle={`${stats.data.agents.active} active`}
            />
            <StatCard
              label="Projects"
              value={stats.data.projects.total}
              color="text-indigo-600"
              icon="🎯"
            />
          </div>
        </div>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Agents</h2>
        {agents.loading ? (
          <div className="text-gray-400 text-sm">Loading agents...</div>
        ) : agents.error ? (
          <div className="text-red-500 text-sm">Error: {agents.error}</div>
        ) : agents.data ? (
          <AgentList agents={agents.data} />
        ) : null}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Issues</h2>
        {issues.loading ? (
          <div className="text-gray-400 text-sm">Loading issues...</div>
        ) : issues.error ? (
          <div className="text-red-500 text-sm">Error: {issues.error}</div>
        ) : issues.data ? (
          <IssueList issues={issues.data} />
        ) : null}
      </section>
    </div>
  );
}
