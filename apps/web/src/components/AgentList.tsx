import { Link } from "react-router-dom";
import type { Agent } from "../lib/api";

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-gray-300",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  active: { text: "Active", color: "text-green-700 bg-green-50" },
  idle: { text: "Idle", color: "text-gray-600 bg-gray-50" },
  error: { text: "Error", color: "text-red-700 bg-red-50" },
};

interface AgentListProps {
  agents: Agent[];
}

function isStaleHeartbeat(lastHeartbeatAt: string | null): boolean {
  if (!lastHeartbeatAt) return true;
  const diff = Date.now() - new Date(lastHeartbeatAt).getTime();
  return diff > 3600000; // 1 hour
}

function formatHeartbeat(lastHeartbeatAt: string | null): string {
  if (!lastHeartbeatAt) return "Never";
  const diff = Date.now() - new Date(lastHeartbeatAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No agents registered.
      </div>
    );
  }

  // Sort: error first, then stale, then active
  const sorted = [...agents].sort((a, b) => {
    if (a.status === "error" && b.status !== "error") return -1;
    if (a.status !== "error" && b.status === "error") return 1;
    const aStale = isStaleHeartbeat(a.lastHeartbeatAt);
    const bStale = isStaleHeartbeat(b.lastHeartbeatAt);
    if (aStale && !bStale) return -1;
    if (!aStale && bStale) return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sorted.map((agent) => {
        const stale = isStaleHeartbeat(agent.lastHeartbeatAt);
        const hasIssue = agent.status === "error" || stale;
        const statusInfo = STATUS_LABEL[agent.status] ?? { text: agent.status, color: "text-gray-600 bg-gray-50" };

        return (
          <Link
            key={agent.id}
            to={`/agents/${agent.id}`}
            className={`bg-white rounded-lg border p-4 hover:border-indigo-300 transition-all group ${
              hasIssue ? "border-orange-200 shadow-sm" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xl">{agent.icon ?? "🤖"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                    {agent.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{agent.title ?? agent.role}</p>
                </div>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${STATUS_DOT[agent.status] ?? "bg-gray-300"}`} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
              <span className={`text-xs ${stale ? "text-orange-600 font-semibold" : "text-gray-400"}`}>
                {formatHeartbeat(agent.lastHeartbeatAt)}
              </span>
            </div>
            {hasIssue && (
              <div className="mt-2 pt-2 border-t border-orange-100">
                <p className="text-xs text-orange-700 font-medium">
                  {agent.status === "error" ? "⚠️ Error status" : "⏰ Stale heartbeat"}
                </p>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
