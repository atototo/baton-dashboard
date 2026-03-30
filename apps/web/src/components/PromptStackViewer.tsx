import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { PromptStack } from "../lib/api.js";
import { PromptLayer } from "./PromptLayer.js";

interface PromptStackViewerProps {
  agentId: string;
}

export function PromptStackViewer({ agentId }: PromptStackViewerProps) {
  const [stack, setStack] = useState<PromptStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getAgentPromptStack(agentId)
      .then(setStack)
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

  if (!stack || stack.layers.length === 0) {
    return <div className="text-gray-500 text-sm py-6 text-center">프롬프트 스택이 없습니다.</div>;
  }

  const totalChars = stack.totalChars || stack.layers.reduce((sum, l) => sum + l.charCount, 0);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">프롬프트 스택</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {stack.layers.length}개 계층 · {(totalChars / 1000).toFixed(1)}k자
            </p>
          </div>
          {stack.composedAt && (
            <div className="text-xs text-gray-500">
              {new Date(stack.composedAt).toLocaleString("ko-KR")}
            </div>
          )}
        </div>
      </div>

      {/* Layers */}
      <div className="space-y-3">
        {stack.layers
          .sort((a, b) => a.order - b.order)
          .map((layer) => (
            <PromptLayer key={layer.key} layer={layer} />
          ))}
      </div>
    </div>
  );
}
