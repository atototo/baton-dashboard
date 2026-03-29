import { useState } from "react";
import { api } from "../lib/api";
import { useQuery } from "../hooks/useQuery";
import { useCompany } from "../context/CompanyContext";
import { IssueList } from "../components/IssueList";
import { CreateIssueDialog } from "../components/CreateIssueDialog";

export function IssueListPage() {
  const { selectedCompanyId } = useCompany();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: issues, loading, error, refetch } = useQuery(
    () => api.getIssues(selectedCompanyId ? { companyId: selectedCompanyId } : undefined),
    [selectedCompanyId]
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Issues</h1>
          <p className="text-gray-500 mt-1">
            {selectedCompanyId ? "회사별 전체 이슈 목록입니다." : "회사를 선택해 주세요."}
          </p>
        </div>
        <button
          onClick={() => setIsDialogOpen(true)}
          disabled={!selectedCompanyId}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 이슈
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-center border border-red-100">
          <p className="text-red-600 font-semibold text-lg">이슈 목록을 불러오지 못했습니다.</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
          <button
            onClick={() => refetch()}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 transition-all"
          >
            다시 시도
          </button>
        </div>
      ) : issues ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-[32px_100px_100px_1fr_150px_150px_100px] gap-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <div className="text-center">P</div>
            <div>ID</div>
            <div>Status</div>
            <div>Title</div>
            <div>Assignee</div>
            <div>Project</div>
            <div className="text-right">Updated</div>
          </div>
          <IssueList issues={issues} />
        </div>
      ) : null}

      <CreateIssueDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
