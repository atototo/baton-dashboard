import React, { useState, useEffect } from "react";
import { api, type Project, type Agent } from "../lib/api";
import { useCompany } from "../context/CompanyContext";

interface CreateIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateIssueDialog({ isOpen, onClose, onSuccess }: CreateIssueDialogProps) {
  const { selectedCompanyId } = useCompany();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [projectId, setProjectId] = useState("");
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedCompanyId) {
      setLoading(true);
      Promise.all([
        api.getProjects(selectedCompanyId),
        api.getAgents(selectedCompanyId),
      ])
        .then(([p, a]) => {
          setProjects(p);
          setAgents(a);
        })
        .catch((err) => {
          console.error("Failed to load projects/agents:", err);
          setError("Failed to load options");
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedCompanyId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createIssue({
        companyId: selectedCompanyId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        projectId: projectId || undefined,
        assigneeAgentId: assigneeAgentId || undefined,
      });
      onSuccess();
      onClose();
      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setProjectId("");
      setAssigneeAgentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">새 이슈 생성</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all sm:text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="이슈 제목을 입력하세요"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">설명</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all sm:text-sm"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상세 내용을 입력하세요 (마크다운 지원)"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">우선순위</label>
              <select
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all sm:text-sm appearance-none bg-no-repeat bg-[right_1rem_center]"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">프로젝트</label>
              <select
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all sm:text-sm appearance-none bg-no-repeat bg-[right_1rem_center]"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">지정 안 함</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">에이전트 배정</label>
            <select
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all sm:text-sm appearance-none bg-no-repeat bg-[right_1rem_center]"
              value={assigneeAgentId}
              onChange={(e) => setAssigneeAgentId(e.target.value)}
            >
              <option value="">미배정</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.title || a.role})</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-500">에이전트를 지정하면 바톤이 자동으로 작업을 시작합니다.</p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 flex items-center gap-2 text-sm text-red-600">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="inline-flex justify-center rounded-lg border border-transparent bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? "생성 중..." : "이슈 생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
