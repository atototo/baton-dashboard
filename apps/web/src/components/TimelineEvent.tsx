import { useState, useEffect } from "react";
import { api, type TimelineEvent as TimelineEventData, type RunEvent } from "../lib/api";
import { PromptSnapshot } from "./PromptSnapshot";

interface TimelineEventProps {
  event: TimelineEventData;
}

export function TimelineEvent({ event }: TimelineEventProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<RunEvent[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const dateStr = new Date(event.createdAt).toLocaleString();

  useEffect(() => {
    if (showLogs && event.runId && logs.length === 0) {
      setLoadingLogs(true);
      api.getRunEvents(event.runId)
        .then(setLogs)
        .catch(console.error)
        .finally(() => setLoadingLogs(false));
    }
  }, [showLogs, event.runId]);

  const renderContent = () => {
    switch (event.type) {
      case "comment":
        return (
          <div className="bg-white p-4 border rounded-xl shadow-sm border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">{event.details.authorAgentIcon || "👤"}</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-900">
                  {event.details.authorAgentName || event.details.authorUserId || "Unknown"}
                </div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{dateStr}</div>
              </div>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{event.details.body}</div>
          </div>
        );
      case "run":
        return (
          <div className="bg-white p-4 border rounded-xl shadow-sm border-blue-100 ring-1 ring-blue-50/50">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{event.details.agentIcon || "🤖"}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-blue-900 tracking-tight">
                    Heartbeat Run by {event.details.agentName}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                    event.details.status === "finished" ? "bg-green-100 text-green-700" :
                    event.details.status === "failed" ? "bg-red-100 text-red-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {event.details.status}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{dateStr}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                <div className="text-[9px] text-blue-400 font-black uppercase mb-0.5">Source</div>
                <div className="text-[11px] font-bold text-blue-900">{event.details.invocationSource}</div>
              </div>
              <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                <div className="text-[9px] text-blue-400 font-black uppercase mb-0.5">Trigger</div>
                <div className="text-[11px] font-bold text-blue-900">{event.details.triggerDetail}</div>
              </div>
            </div>

            {event.details.promptSnapshot && (
              <PromptSnapshot prompt={event.details.promptSnapshot} />
            )}
            {!event.details.promptSnapshot && event.details.contextSnapshot?.promptSnapshot && (
              <PromptSnapshot prompt={event.details.contextSnapshot.promptSnapshot} />
            )}

            <div className="mt-4 pt-4 border-t border-blue-50">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-[11px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest flex items-center gap-1.5 transition-colors"
              >
                {showLogs ? "Hide Execution Logs" : "View Execution Logs"}
                <span className="text-blue-300">{showLogs ? "▲" : "▼"}</span>
              </button>
              
              {showLogs && (
                <div className="mt-3 bg-gray-900 rounded-lg p-3 font-mono text-[11px] leading-relaxed max-h-64 overflow-y-auto custom-scrollbar shadow-inner text-left">
                  {loadingLogs ? (
                    <div className="text-gray-500 animate-pulse">Loading logs...</div>
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <div key={log.id} className="flex gap-3 mb-1.5 last:mb-0 group">
                        <span className="text-gray-600 select-none opacity-50">{new Date(log.createdAt).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        <span className={`font-black w-12 shrink-0 select-none ${
                          log.level === 'error' ? 'text-red-500' :
                          log.level === 'warn' ? 'text-yellow-500' :
                          log.level === 'debug' ? 'text-gray-600' : 'text-blue-500'
                        }`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="text-gray-300 group-hover:text-white transition-colors">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-600 italic">No logs available for this run.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case "approval":
        return (
          <div className="bg-white p-4 border border-amber-100 rounded-xl shadow-sm ring-1 ring-amber-50/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">⚖️</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-amber-900 uppercase tracking-tight">
                    {event.details.approvalType}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                    event.details.status === "approved" ? "bg-green-100 text-green-700" :
                    event.details.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>
                    {event.details.status}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{dateStr}</div>
              </div>
            </div>
            {event.details.payload?.question && (
              <div className="text-sm text-amber-950 mt-3 font-medium bg-amber-50/50 p-3 rounded-lg border border-amber-100/50">
                <div className="text-[9px] text-amber-400 font-black uppercase mb-1">Question</div>
                {event.details.payload.question}
              </div>
            )}
            {event.details.payload?.answer && (
              <div className="text-sm text-green-950 mt-2 font-medium bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                <div className="text-[9px] text-green-400 font-black uppercase mb-1">Answer</div>
                {event.details.payload.answer}
              </div>
            )}
          </div>
        );
      case "activity":
      default:
        return (
          <div className="flex items-center gap-4 py-1 group">
            <div className="w-2 h-2 rounded-full bg-gray-200 group-hover:bg-blue-400 transition-colors" />
            <div className="flex-1 flex items-baseline justify-between gap-4">
              <div className="text-sm font-bold text-gray-900 tracking-tight">
                {event.action}
                <span className="ml-2 font-medium text-gray-400 italic">by {event.actorId}</span>
              </div>
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter whitespace-nowrap">{dateStr}</div>
            </div>
          </div>
        );
    }
  };

  return <div className="py-4 last:pb-0">{renderContent()}</div>;
}
