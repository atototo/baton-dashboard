import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, type Issue } from "../lib/api";
import { IssueTimeline } from "../components/IssueTimeline";
import { CommentThread } from "../components/CommentThread";
import { IssueList } from "../components/IssueList";

type Tab = "details" | "comments" | "timeline" | "subtasks";

export function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [subtasks, setSubtasks] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    
    Promise.all([
      api.getIssue(id),
      api.getIssues({ parentId: id })
    ])
      .then(([issueData, subtasksData]) => {
        setIssue(issueData);
        setSubtasks(subtasksData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <div className="text-sm font-black text-gray-400 uppercase tracking-widest animate-pulse">Loading Context</div>
        </div>
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-gray-500">
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Issue Not Found</h1>
        <p className="text-gray-400 mb-8 font-medium">The requested issue could not be found or has been moved.</p>
        <Link to="/issues" className="px-6 py-3 bg-gray-900 text-white font-black rounded-xl hover:bg-black transition-colors uppercase tracking-widest text-xs">
          Back to list
        </Link>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "details":
        return (
          <div className="bg-white border rounded-2xl p-8 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-xs font-black mb-6 text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-4 h-px bg-gray-200" />
              Description
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed font-medium">
              {issue.description || <span className="text-gray-300 italic font-normal">No description provided for this issue.</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-16 pt-10 border-t border-gray-50">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Created At</h3>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">📅</div>
                  <div className="text-sm font-bold text-gray-900">{new Date(issue.createdAt).toLocaleString()}</div>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Last Modified</h3>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">⏱️</div>
                  <div className="text-sm font-bold text-gray-900">{new Date(issue.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        );
      case "comments":
        return <CommentThread issueId={issue.id} />;
      case "timeline":
        return <IssueTimeline issueId={issue.id} />;
      case "subtasks":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                Subtasks ({subtasks.length})
              </h2>
            </div>
            <IssueList issues={subtasks} />
          </div>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
          <Link to="/issues" className="text-gray-400 hover:text-blue-600 transition-colors">Issues</Link>
          <span className="text-gray-200">/</span>
          <span className="text-blue-600">{issue.identifier || issue.id.slice(0, 8)}</span>
        </div>
        
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-black text-gray-900 leading-[1.1] tracking-tight max-w-4xl">
            {issue.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4">
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ring-1 ring-inset ${
              issue.status === "completed" || issue.status === "done" ? "bg-green-50 text-green-700 border-green-100 ring-green-500/10" :
              issue.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-100 ring-blue-500/10" :
              "bg-gray-50 text-gray-600 border-gray-100 ring-gray-500/10"
            }`}>
              {issue.status.replace("_", " ")}
            </span>
            
            <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ring-1 ring-inset ${
              issue.priority === "urgent" || issue.priority === "high" ? "bg-red-50 text-red-700 border-red-100 ring-red-500/10" :
              issue.priority === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-100 ring-yellow-500/10" :
              "bg-gray-50 text-gray-600 border-gray-100 ring-gray-500/10"
            }`}>
              {issue.priority} priority
            </span>

            {issue.agentName && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg shadow-sm">
                <span className="text-base">{issue.agentIcon || "🤖"}</span>
                <span className="text-[10px] font-black uppercase tracking-widest">{issue.agentName}</span>
              </div>
            )}

            {issue.projectName && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-lg text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-widest">Project</span>
                <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{issue.projectName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar -mx-6 px-6">
        {(["details", "comments", "timeline", "subtasks"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-300 hover:text-gray-500 hover:border-gray-200"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderTabContent()}
      </div>
    </div>
  );
}
