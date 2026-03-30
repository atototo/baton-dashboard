import { useState } from "react";
import type { PromptLayer as PromptLayerType } from "../lib/api.js";

interface PromptLayerProps {
  layer: PromptLayerType;
}

export function PromptLayer({ layer }: PromptLayerProps) {
  const [expanded, setExpanded] = useState(false);

  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case "system":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "user":
        return "bg-green-100 text-green-700 border-green-200";
      case "agent":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "project":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "company":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 font-mono">#{layer.order}</span>
          <span className="text-sm font-semibold text-gray-900">{layer.label}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded border font-medium ${getSourceBadgeColor(
              layer.source
            )}`}
          >
            {layer.source}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{(layer.charCount / 1000).toFixed(1)}k자</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 font-mono px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            {expanded ? "▼ 접기" : "▶ 펼치기"}
          </button>
        </div>
      </div>

      {/* Content */}
      {expanded && layer.content && (
        <div className="border-t border-gray-200 bg-white p-3">
          <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-96 overflow-y-auto">
            {layer.content}
          </pre>
        </div>
      )}
    </div>
  );
}
