import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { AgentCosts } from "../lib/api.js";

interface AgentCostSummaryProps {
  agentId: string;
}

export function AgentCostSummary({ agentId }: AgentCostSummaryProps) {
  const [costs, setCosts] = useState<AgentCosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAgentCosts(agentId)
      .then(setCosts)
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

  if (!costs) {
    return <div className="text-gray-500 text-sm py-6 text-center">비용 정보가 없습니다.</div>;
  }

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">총 비용</div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            ${(costs.summary.totalCostCents / 100).toFixed(4)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">입력 토큰</div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {formatTokens(costs.summary.totalInputTokens)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">출력 토큰</div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {formatTokens(costs.summary.totalOutputTokens)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">이벤트 수</div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {costs.summary.totalEvents}
          </div>
        </div>
      </div>

      {/* By model */}
      {costs.byModel.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">모델별 비용</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">공급자</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">모델</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">비용</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">입력 토큰</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">출력 토큰</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">이벤트 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {costs.byModel.map((m, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs text-gray-900">{m.provider}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-900">{m.model}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-900">
                      ${(m.totalCostCents / 100).toFixed(4)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                      {formatTokens(m.totalInputTokens)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                      {formatTokens(m.totalOutputTokens)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                      {m.eventCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent runs */}
      {costs.recent.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">최근 실행</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">발생 시각</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">모델</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">비용</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">입력 토큰</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">출력 토큰</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {costs.recent.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {new Date(r.occurredAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-700">
                      {r.provider}/{r.model}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-900">
                      ${(r.costCents / 100).toFixed(4)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                      {formatTokens(r.inputTokens)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-gray-600">
                      {formatTokens(r.outputTokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
