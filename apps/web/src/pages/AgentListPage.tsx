import { api } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { AgentList } from "../components/AgentList";
import { useCompany } from "../context/CompanyContext";

export function AgentListPage() {
  const { selectedCompanyId } = useCompany();

  const agents = useQuery(
    () => api.getAgents(selectedCompanyId || undefined),
    [selectedCompanyId]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
        <button
          onClick={() => agents.refetch()}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-50 bg-white"
        >
          Refresh
        </button>
      </div>

      {agents.loading ? (
        <div className="text-gray-400 text-sm">Loading agents...</div>
      ) : agents.error ? (
        <div className="text-red-500 text-sm">Error: {agents.error}</div>
      ) : agents.data ? (
        <AgentList agents={agents.data} />
      ) : null}
    </div>
  );
}
