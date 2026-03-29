import { useState } from "react";

interface PromptSnapshotProps {
  prompt: any;
}

export function PromptSnapshot({ prompt }: PromptSnapshotProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!prompt) return null;

  const getTokens = (text?: string) => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  };

  const renderLayer = (title: string, content: string | null | undefined, color: string = "gray") => {
    if (!content) return null;
    const tokens = getTokens(content);
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className={`text-${color}-500 font-bold text-[10px] uppercase tracking-wider`}>{title}</div>
          <div className="text-[10px] text-gray-400 font-medium">{tokens.toLocaleString()} tokens</div>
        </div>
        <div className={`bg-white p-3 border rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed border-${color}-100`}>
          {content}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 border rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 text-left text-sm font-bold flex items-center justify-between transition-colors ${
          isOpen ? "bg-gray-50 text-blue-600 border-b" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📄</span>
          <span>Prompt Snapshot</span>
        </div>
        <span className="text-gray-400 transform transition-transform duration-200" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="p-4 space-y-6 bg-gray-50/50 max-h-[600px] overflow-y-auto custom-scrollbar">
          {/* 5-layer snapshot (if available) */}
          {prompt.agentInstructions && renderLayer("Layer 1: Agent Instructions", prompt.agentInstructions, "indigo")}
          {prompt.batonSkill && renderLayer("Layer 2: Baton Skill", prompt.batonSkill, "purple")}
          {prompt.projectConventions && renderLayer("Layer 3: Project Conventions", prompt.projectConventions, "blue")}
          {prompt.wakeContext && renderLayer("Layer 4: Wake Context", typeof prompt.wakeContext === "string" ? prompt.wakeContext : JSON.stringify(prompt.wakeContext, null, 2), "amber")}
          {prompt.promptTemplate && renderLayer("Layer 5: Prompt Template", prompt.promptTemplate, "rose")}

          {/* Fallback to basic system/messages/response if 5-layer not present or in addition to it */}
          {prompt.system && renderLayer("System", prompt.system, "slate")}
          
          {prompt.messages && prompt.messages.map((m: any, i: number) => (
            <div key={i}>
              {renderLayer(`${m.role.toUpperCase()}`, m.content, m.role === "assistant" ? "green" : "blue")}
            </div>
          ))}

          {prompt.response && renderLayer("Response", prompt.response, "green")}
        </div>
      )}
    </div>
  );
}
