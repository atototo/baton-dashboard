import { Link } from "react-router-dom";
import type { Agent } from "../lib/api";

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-gray-300",
  error: "bg-red-500",
};

interface AgentListProps {
  agents: Agent[];
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No agents registered.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {agents.map((agent) => (
        <Link
          key={agent.id}
          to={`/agents/${agent.id}`}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-indigo-300 transition-colors group shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{agent.icon ?? "🤖"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                {agent.name}
              </p>
              <p className="text-xs text-gray-500">{agent.title ?? agent.role}</p>
            </div>
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[agent.status] ?? "bg-gray-300"}`} />
          </div>
          {agent.lastHeartbeatAt && (
            <p className="text-xs text-gray-400 mt-2">
              Last active: {new Date(agent.lastHeartbeatAt).toLocaleString()}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
