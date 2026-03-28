import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ListTodo, FolderKanban, Bot, BarChart3, ChevronDown } from "lucide-react";
import { useCompany } from "../context/CompanyContext";

const NAV_ITEMS = [
  { label: "대시보드", icon: LayoutDashboard, path: "/" },
  { label: "이슈", icon: ListTodo, path: "/issues" },
  { label: "프로젝트", icon: FolderKanban, path: "/projects" },
  { label: "에이전트", icon: Bot, path: "/agents" },
  { label: "모니터링", icon: BarChart3, path: "/monitoring" },
];

export function Sidebar() {
  const location = useLocation();
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-2xl">🏏</span>
          <h1 className="text-xl font-bold text-gray-900">Baton</h1>
        </div>

        <div className="relative mb-8">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Company
          </label>
          <div className="relative">
            <select
              value={selectedCompanyId || ""}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || 
                             (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-gray-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">Admin User</p>
            <p className="text-xs text-gray-500 truncate">admin@baton.team</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
