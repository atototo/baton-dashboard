import { useState } from "react";

interface PromptSnapshotProps {
  prompt: any;
}

export function PromptSnapshot({ prompt }: PromptSnapshotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  if (!prompt) return null;

  const getTokens = (text?: string) => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  };

  const renderLayer = (title: string, content: string | null | undefined, color: string = "gray") => {
    if (!content) return null;
    const tokens = getTokens(content);
    return (
      <div key={title} className="space-y-1">
        <div className="flex items-center justify-between">
          <div className={`text-xs font-black uppercase tracking-wider`} style={{ color: `var(--color-${color}-500, #6b7280)` }}>{title}</div>
          <div className="text-[10px] text-gray-400 font-medium">{tokens.toLocaleString()} tokens</div>
        </div>
        <div className="bg-white p-3 border rounded-lg text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed border-gray-200 max-h-60 overflow-y-auto">
          {content}
        </div>
      </div>
    );
  };

  // Collect all renderable sections
  const sections: React.ReactNode[] = [];

  // 5-layer baton structure
  if (prompt.agentInstructions) sections.push(renderLayer("Layer 1: Agent Instructions", prompt.agentInstructions, "indigo"));
  if (prompt.batonSkill) sections.push(renderLayer("Layer 2: Baton Skill", prompt.batonSkill, "purple"));
  if (prompt.projectConventions) sections.push(renderLayer("Layer 3: Project Conventions", prompt.projectConventions, "blue"));
  if (prompt.wakeContext) sections.push(renderLayer("Layer 4: Wake Context", typeof prompt.wakeContext === "string" ? prompt.wakeContext : JSON.stringify(prompt.wakeContext, null, 2), "amber"));
  if (prompt.promptTemplate) sections.push(renderLayer("Layer 5: Prompt Template", prompt.promptTemplate, "rose"));

  // Basic openai/anthropic structure
  if (prompt.system) sections.push(renderLayer("System", prompt.system, "slate"));
  if (prompt.systemPrompt) sections.push(renderLayer("System Prompt", prompt.systemPrompt, "slate"));
  if (prompt.userMessage) sections.push(renderLayer("User Message", prompt.userMessage, "blue"));
  if (prompt.context) sections.push(renderLayer("Context", typeof prompt.context === "string" ? prompt.context : JSON.stringify(prompt.context, null, 2), "teal"));

  if (prompt.messages && Array.isArray(prompt.messages)) {
    prompt.messages.forEach((m: any, i: number) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content, null, 2);
      sections.push(renderLayer(`${String(m.role || "message").toUpperCase()} [${i + 1}]`, content, m.role === "assistant" ? "green" : "blue"));
    });
  }

  if (prompt.response) sections.push(renderLayer("Response", typeof prompt.response === "string" ? prompt.response : JSON.stringify(prompt.response, null, 2), "green"));

  // Generic: try all string/object top-level keys not already handled
  const knownKeys = new Set(["agentInstructions","batonSkill","projectConventions","wakeContext","promptTemplate","system","systemPrompt","userMessage","context","messages","response"]);
  Object.entries(prompt).forEach(([key, val]) => {
    if (knownKeys.has(key)) return;
    if (val == null) return;
    const text = typeof val === "string" ? val : JSON.stringify(val, null, 2);
    sections.push(renderLayer(key, text, "gray"));
  });

  const filteredSections = sections.filter(Boolean);
  const rawJson = JSON.stringify(prompt, null, 2);

  return (
    <div className="mt-3 border rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-2.5 text-left text-sm font-bold flex items-center justify-between transition-colors ${
          isOpen ? "bg-gray-50 text-blue-600 border-b" : "text-gray-700 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📄</span>
          <span>Prompt Snapshot</span>
          {filteredSections.length === 0 && <span className="text-[10px] text-gray-400 font-medium">(raw only)</span>}
        </div>
        <span className="text-gray-400 transition-transform duration-200" style={{ display: 'inline-block', transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {isOpen && (
        <div className="p-4 space-y-4 bg-gray-50/50 max-h-[600px] overflow-y-auto">
          {filteredSections.length > 0 ? (
            filteredSections
          ) : (
            <div className="text-xs text-gray-500 italic">No recognized fields — showing raw data below.</div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="text-[11px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest flex items-center gap-1"
            >
              {showRaw ? "Hide" : "Show"} Raw JSON
              <span>{showRaw ? "▲" : "▼"}</span>
            </button>
            {showRaw && (
              <pre className="mt-2 bg-gray-900 text-gray-300 p-3 rounded-lg text-[10px] font-mono overflow-auto max-h-80 leading-relaxed">
                {rawJson}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
