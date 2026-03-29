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
  description: string | null;
  issueNumber: number | null;
  agentName?: string | null;
  agentIcon?: string | null;
  projectName?: string | null;
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorAgentId: string | null;
  authorUserId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  authorAgentName?: string | null;
  authorAgentIcon?: string | null;
}

export interface TimelineEvent {
  id: string;
  type: "activity" | "comment" | "approval" | "run";
  issueId: string;
  createdAt: string;
  action: string;
  actorType: "agent" | "user" | "system";
  actorId: string;
  runId: string | null;
  details: {
    // Common
    body?: string;
    status?: string;
    
    // Comment
    authorAgentId?: string | null;
    authorUserId?: string | null;
    authorAgentName?: string | null;
    authorAgentIcon?: string | null;
    
    // Run
    agentId?: string;
    agentName?: string;
    agentIcon?: string;
    invocationSource?: string;
    triggerDetail?: string;
    startedAt?: string;
    finishedAt?: string;
    contextSnapshot?: any;
    promptSnapshot?: any;
    
    // Approval
    approvalId?: string;
    approvalType?: string;
    payload?: any;
    
    // Activity
    [key: string]: any;
  };
}

export interface RunEvent {
  id: string;
  runId: string;
  eventType: string;
  stream: "stdout" | "stderr" | "system";
  level: "info" | "error" | "warn" | "debug";
  message: string;
  payload: any;
  createdAt: string;
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
  getOverview: (companyId?: string) => {
    const qs = companyId ? `?companyId=${companyId}` : "";
    return fetchJson<OverviewStats>(`/stats/overview${qs}`);
  },
  getCompanies: () => fetchJson<Company[]>("/companies"),
  getIssues: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJson<Issue[]>(`/issues${qs}`);
  },
  getIssue: (id: string) => fetchJson<Issue>(`/issues/${id}`),
  getIssueComments: (id: string) => fetchJson<IssueComment[]>(`/issues/${id}/comments`),
  createIssueComment: (id: string, body: string) =>
    fetch(`${BASE}/issues/${id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to create comment");
      return res.json() as Promise<IssueComment>;
    }),
  getIssueTimeline: (id: string) => fetchJson<TimelineEvent[]>(`/issues/${id}/timeline`),
  getAgents: (companyId?: string) => {
    const qs = companyId ? `?companyId=${companyId}` : "";
    return fetchJson<Agent[]>(`/agents${qs}`);
  },
  getProjects: (companyId?: string) => {
    const qs = companyId ? `?companyId=${companyId}` : "";
    return fetchJson<Project[]>(`/projects${qs}`);
  },
  getRunPromptSnapshot: (id: string) => fetchJson<any>(`/runs/${id}/prompt-snapshot`),
  getRunEvents: (id: string) => fetchJson<RunEvent[]>(`/runs/${id}/events`),
};
