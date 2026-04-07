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
    done: number;
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

export interface RunLog {
  runId: string;
  store: string;
  logRef: string;
  content: string; // JSONL - each line: {"ts":"...","stream":"stdout"|"stderr"|"system","chunk":"..."}
  nextOffset?: number;
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

export interface IssueStatusStats {
  status: string;
  count: number;
}

export interface ProjectStats {
  total: number;
  byStatus: Record<string, number>;
}

export interface AgentInstructions {
  agentId: string;
  source: string;
  entryFile: string;
  content: string;
  charCount: number;
  updatedAt: string;
}

export interface PromptLayer {
  order: number;
  key: string;
  label: string;
  source: string;
  content: string;
  charCount: number;
  tokenEstimate: number;
  metadata: Record<string, unknown> | null;
}

export interface PromptStack {
  agentId: string;
  composedAt: string | null;
  totalChars: number;
  layers: PromptLayer[];
}

export interface AgentRun {
  id: string;
  agentId: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  error: string | null;
  usage: Record<string, unknown> | null;
}

export interface AgentRuns {
  agentId: string;
  items: AgentRun[];
}

export interface AgentCosts {
  agentId: string;
  summary: {
    totalEvents: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
  };
  byModel: Array<{
    provider: string;
    model: string;
    eventCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
  }>;
  recent: Array<{
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    occurredAt: string;
  }>;
}

export interface CanonicalPlan {
  text: string;
  source: string;
  approvalId: string;
  approvalType: string;
  approvalStatus: string;
  updatedAt: string;
}

export interface RevisionEntry {
  approvalId: string;
  approvalType: string;
  approvalStatus: string;
  kind: string;
  summary: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface DiffMetadata {
  available: boolean;
  branch: string | null;
  baseBranch: string | null;
  commitSha: string | null;
  pullRequestUrl: string | null;
  pullRequestNumber: number | null;
}

export interface ContextSignal {
  key: string;
  label: string;
  value: number;
}

export interface ContextDiagnostics {
  signals: ContextSignal[];
  details: Record<string, unknown>;
}

export interface WorkflowSession {
  id: string;
  issueId: string;
  approvalId: string;
  approvalType: string;
  approvalStatus: string;
  kind: string;
  status: string;
  epoch: number;
  stale: boolean;
  revision: boolean;
  consumed: boolean;
  branch: string | null;
  baseBranch: string | null;
  commitSha: string | null;
  pullRequestUrl: string | null;
  pullRequestNumber: number | null;
  prOpenedAt: string | null;
  lastPrCheckedAt: string | null;
  canonicalPlan: CanonicalPlan | null;
  revisionHistory: RevisionEntry[];
  diff: DiffMetadata;
  contextDiagnostics: ContextDiagnostics;
  requestedByAgentId: string | null;
  requestedByUserId: string | null;
  runId: string | null;
  runStatus: string | null;
  runInvocationSource: string | null;
  runTriggerDetail: string | null;
  runStartedAt: string | null;
  runFinishedAt: string | null;
  runCount: number;
  contextSnapshot: unknown | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  updatedAt: string;
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
  updateIssue: (id: string, updates: Partial<Issue>) =>
    fetch(`${BASE}/issues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to update issue");
      return res.json() as Promise<Issue>;
    }),
  getIssueStats: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return fetchJson<IssueStatusStats[]>(`/issues/stats/summary${qs}`);
  },
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
  getIssueWorkflowSessions: (id: string) => fetchJson<WorkflowSession[]>(`/issues/${id}/workflow-sessions`),
  getAgents: (companyId?: string) => {
    const qs = companyId ? `?companyId=${companyId}` : "";
    return fetchJson<Agent[]>(`/agents${qs}`);
  },
  getAgent: (id: string) => fetchJson<Agent>(`/agents/${id}`),
  getProjects: (companyId?: string) => {
    const qs = companyId ? `?companyId=${companyId}` : "";
    return fetchJson<Project[]>(`/projects${qs}`);
  },
  getProject: (id: string) => fetchJson<Project>(`/projects/${id}`),
  getProjectStats: async (id: string): Promise<ProjectStats> => {
    try {
      return await fetchJson<ProjectStats>(`/projects/${id}/stats`);
    } catch (e) {
      console.warn("Failed to get project stats via direct endpoint, falling back to issues summary", e);
      const rows = await api.getIssueStats({ projectId: id });
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
      const total = rows.reduce((sum, r) => sum + r.count, 0);
      return { total, byStatus };
    }
  },
  createIssue: (data: {
    title: string;
    companyId: string;
    projectId?: string | null;
    parentId?: string | null;
    priority?: string;
    description?: string | null;
  }) =>
    fetch(`${BASE}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((res) => {
      if (!res.ok) throw new Error("Failed to create issue");
      return res.json() as Promise<Issue>;
    }),
  getRunPromptSnapshot: (id: string) => fetchJson<any>(`/runs/${id}/prompt-snapshot`),
  getRunEvents: (id: string) => fetchJson<RunEvent[]>(`/runs/${id}/events`),
  getRunLog: (id: string) => fetchJson<RunLog>(`/runs/${id}/log`),
  getAgentInstructions: (id: string) => fetchJson<AgentInstructions>(`/agents/${id}/instructions`),
  getAgentPromptStack: (id: string) => fetchJson<PromptStack>(`/agents/${id}/prompt-stack`),
  getAgentRuns: (id: string) => fetchJson<AgentRuns>(`/agents/${id}/runs`),
  getAgentCosts: (id: string) => fetchJson<AgentCosts>(`/agents/${id}/costs`),
};
