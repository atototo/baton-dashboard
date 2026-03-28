const BASE = "/api";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface OverviewStats {
  issues: {
    total: number;
    backlog: number;
    inProgress: number;
    inReview: number;
    completed: number;
    cancelled: number;
  };
  agents: { total: number; active: number; idle: number };
  projects: { total: number };
  companies: { total: number };
}

export interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  identifier: string | null;
  projectId: string | null;
  assigneeAgentId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  agentName: string | null;
  agentIcon: string | null;
  projectName: string | null;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  icon: string | null;
  companyId: string;
  reportsTo: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string | null;
  leadAgentId: string | null;
  targetDate: string | null;
  createdAt: string;
  leadAgentName: string | null;
  leadAgentIcon: string | null;
}

export interface Company {
  id: string;
  name: string;
}

export const api = {
  getOverview: () => fetchJson<OverviewStats>("/stats/overview"),
  getCompanies: () => fetchJson<Company[]>("/companies"),
  getIssues: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJson<Issue[]>(`/issues${qs}`);
  },
  getAgents: () => fetchJson<Agent[]>("/agents"),
  getProjects: () => fetchJson<Project[]>("/projects"),
};
