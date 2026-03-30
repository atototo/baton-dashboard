import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Agent } from "../lib/api.js";
import { PromptStackViewer } from "../components/PromptStackViewer.js";
import { AgentCostSummary } from "../components/AgentCostSummary.js";
import { RunTrace } from "../components/RunTrace.js";

type Tab = "overview" | "prompts" | "runs" | "costs";

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    api
      .getAgent(id)
      .then(setAgent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        <span className="text-sm">로딩 중…</span>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 text-sm mb-4">{error || "에이전트를 찾을 수 없습니다."}</p>
        <button
          onClick={() => navigate("/agents")}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "개요" },
    { key: "prompts", label: "프롬프트" },
    { key: "runs", label: "실행 기록" },
    { key: "costs", label: "비용" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 pb-3 border-b border-gray-200">
        <div className="text-2xl">{agent.icon || "🤖"}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{agent.name}</h1>
          {agent.title && <p className="text-sm text-gray-600">{agent.title}</p>}
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                agent.status === "running"
                  ? "bg-green-100 text-green-700"
                  : agent.status === "idle"
                  ? "bg-gray-100 text-gray-600"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {agent.status}
            </span>
            <span className="text-xs text-gray-500">{agent.role}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                tab === t.key
                  ? "text-violet-600 border-b-2 border-violet-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {tab === "overview" && <OverviewTab agent={agent} />}
        {tab === "prompts" && id && <PromptStackViewer agentId={id} />}
        {tab === "runs" && id && <RunsTab agentId={id} />}
        {tab === "costs" && id && <AgentCostSummary agentId={id} />}
      </div>
    </div>
  );
}

function OverviewTab({ agent }: { agent: Agent }) {
  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("ko-KR") : "—";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-gray-500">ID</dt>
            <dd className="font-mono text-gray-900 text-xs break-all">{agent.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">역할</dt>
            <dd className="text-gray-900">{agent.role}</dd>
          </div>
          <div>
            <dt className="text-gray-500">상태</dt>
            <dd className="text-gray-900">{agent.status}</dd>
          </div>
          <div>
            <dt className="text-gray-500">마지막 하트비트</dt>
            <dd className="text-gray-900">{formatDate(agent.lastHeartbeatAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">생성일</dt>
            <dd className="text-gray-900">{formatDate(agent.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function RunsTab({ agentId }: { agentId: string }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAgentRuns(agentId)
      .then((data) => {
        setRuns(data.items || []);
        if (data.items.length > 0) {
          setSelectedRunId(data.items[0].id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-400">
        <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        <span className="text-xs">로딩 중…</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 text-sm py-4">{error}</div>;
  }

  if (runs.length === 0) {
    return <div className="text-gray-500 text-sm py-6 text-center">실행 기록이 없습니다.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Run list */}
      <div className="md:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
        {runs.map((run) => (
          <button
            key={run.id}
            onClick={() => setSelectedRunId(run.id)}
            className={`w-full text-left p-3 rounded border transition-colors ${
              selectedRunId === run.id
                ? "border-violet-500 bg-violet-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${
                  run.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : run.status === "running"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {run.status}
              </span>
              <span className="text-xs text-gray-500">{run.invocationSource}</span>
            </div>
            <div className="text-xs text-gray-600">
              {new Date(run.startedAt).toLocaleString("ko-KR")}
            </div>
            {run.usage && typeof run.usage === "object" && "input_tokens" in run.usage && (
              <div className="text-[10px] text-gray-500 mt-1 font-mono">
                {run.usage.input_tokens}→{run.usage.output_tokens} tokens
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Run detail */}
      <div className="md:col-span-2">
        {selectedRunId ? (
          <div className="border border-gray-200 rounded-lg p-4">
            <RunTrace runId={selectedRunId} />
          </div>
        ) : (
          <div className="text-gray-500 text-sm py-6 text-center">
            실행 기록을 선택하세요.
          </div>
        )}
      </div>
    </div>
  );
}
