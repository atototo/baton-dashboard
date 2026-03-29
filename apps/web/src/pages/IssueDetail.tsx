import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { api, type Issue } from "../lib/api.js";
import { IssueTimeline } from "../components/IssueTimeline.js";
import { CommentThread } from "../components/CommentThread.js";
import { IssueList } from "../components/IssueList.js";

type Tab = "details" | "comments" | "timeline" | "subtasks";

export function IssueDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [issue, setIssue] = useState<Issue | null>(location.state?.issue ?? null);
  const [subtasks, setSubtasks] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(!location.state?.issue);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  useEffect(() => {
    if (!id) return;
    
    const fetchIssueData = async () => {
      setLoading(true);
      try {
        let issueData = issue;
        
        // If we don't have the issue in state, or if the ID changed
        if (!issueData || (issueData.id !== id && issueData.identifier !== id)) {
          try {
            // Try fetching by ID first
            issueData = await api.getIssue(id);
          } catch (e) {
            // If fetching by ID fails (404 for identifier), try fetching all issues and filtering
            const allIssues = await api.getIssues({ limit: "100" });
            const found = allIssues.find(i => i.identifier === id);
            if (found) {
              issueData = found;
            } else {
              throw e;
            }
          }
        }
        
        if (issueData) {
          setIssue(issueData);
          const subtasksData = await api.getIssues({ parentId: issueData.id });
          setSubtasks(subtasksData);
        }
      } catch (error) {
        console.error("Failed to load issue:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssueData();
  }, [id]);

  if (loading && !issue) {
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
    <div className="flex flex-col -mx-8 -my-6 h-[calc(100vh-0px)] overflow-hidden">
      {/* Breadcrumb + title + badges — compact single block */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400 mb-1.5">
          <Link to="/issues" className="hover:text-blue-600 transition-colors">Issues</Link>
          <span>/</span>
          <span className="text-blue-600">{issue.identifier || issue.id.slice(0, 8)}</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">
          {issue.title}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
            issue.status === "completed" || issue.status === "done" ? "bg-green-50 text-green-700 border-green-200" :
            issue.status === "in_progress" ? "bg-blue-50 text-blue-700 border-blue-200" :
            "bg-gray-50 text-gray-600 border-gray-200"
          }`}>
            {issue.status.replace("_", " ")}
          </span>

          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
            issue.priority === "urgent" || issue.priority === "high" ? "bg-red-50 text-red-700 border-red-200" :
            issue.priority === "medium" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
            "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
            {issue.priority}
          </span>

          {issue.agentName && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-900 text-white rounded text-[10px] font-bold">
              <span>{issue.agentIcon || "🤖"}</span>
              <span className="uppercase tracking-wide">{issue.agentName}</span>
            </div>
          )}

          {issue.projectName && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span>Project</span>
              <span className="text-gray-700 font-semibold">{issue.projectName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto no-scrollbar shrink-0 px-6">
        {(["details", "comments", "timeline", "subtasks"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content — fills remaining height; timeline manages its own scroll internally */}
      <div className={`flex-1 min-h-0 px-6 ${activeTab === "timeline" ? "overflow-hidden py-3" : "overflow-y-auto py-4"}`}>
        {renderTabContent()}
      </div>
    </div>
  );
}
