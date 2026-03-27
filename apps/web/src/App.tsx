import { api } from "./lib/api";
import { useQuery } from "./hooks/useQuery";
import { StatCard } from "./components/StatCard";
import { IssueList } from "./components/IssueList";
import { AgentList } from "./components/AgentList";

function App() {
  const stats = useQuery(() => api.getOverview(), []);
  const issues = useQuery(() => api.getIssues({ limit: "20" }), []);
  const agents = useQuery(() => api.getAgents(), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏏</span>
            <h1 className="text-xl font-semibold text-gray-900">Baton Dashboard</h1>
          </div>
          <button
            onClick={() => {
              stats.refetch();
              issues.refetch();
              agents.refetch();
            }}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {stats.loading ? (
          <div className="text-gray-400 text-sm">Loading stats...</div>
        ) : stats.error ? (
          <div className="text-red-500 text-sm">Error: {stats.error}</div>
        ) : stats.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Total Issues" value={stats.data.issues.total} />
            <StatCard label="Backlog" value={stats.data.issues.backlog} color="text-gray-600" />
            <StatCard label="In Progress" value={stats.data.issues.inProgress} color="text-blue-600" />
            <StatCard label="In Review" value={stats.data.issues.inReview} color="text-yellow-600" />
            <StatCard label="Completed" value={stats.data.issues.completed} color="text-green-600" />
            <StatCard label="Agents" value={stats.data.agents.total} color="text-purple-600" />
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
      </main>
    </div>
  );
}

export default App;
