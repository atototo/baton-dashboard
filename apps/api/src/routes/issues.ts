import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc, and, sql, count, isNull, asc, inArray, or } from "drizzle-orm";

export const issuesRoute = new Hono();

const issueSummarySelect = {
  id: schema.issues.id,
  companyId: schema.issues.companyId,
  projectId: schema.issues.projectId,
  goalId: schema.issues.goalId,
  parentId: schema.issues.parentId,
  title: schema.issues.title,
  description: schema.issues.description,
  status: schema.issues.status,
  priority: schema.issues.priority,
  assigneeAgentId: schema.issues.assigneeAgentId,
  assigneeUserId: schema.issues.assigneeUserId,
  createdByAgentId: schema.issues.createdByAgentId,
  createdByUserId: schema.issues.createdByUserId,
  requestDepth: schema.issues.requestDepth,
  billingCode: schema.issues.billingCode,
  startedAt: schema.issues.startedAt,
  completedAt: schema.issues.completedAt,
  cancelledAt: schema.issues.cancelledAt,
  createdAt: schema.issues.createdAt,
  updatedAt: schema.issues.updatedAt,
  issueNumber: schema.issues.issueNumber,
  identifier: schema.issues.identifier,
  checkoutRunId: schema.issues.checkoutRunId,
  executionRunId: schema.issues.executionRunId,
  executionAgentNameKey: schema.issues.executionAgentNameKey,
  executionLockedAt: schema.issues.executionLockedAt,
  executionWorkspaceId: schema.issues.executionWorkspaceId,
  delegation: schema.issues.delegation,
  agentName: schema.agents.name,
  agentIcon: schema.agents.icon,
  projectName: schema.projects.name,
};

// GET /api/issues/stats/summary - 이슈 통계
issuesRoute.get("/stats/summary", async (c) => {
  const result = await db
    .select({
      status: schema.issues.status,
      count: count(),
    })
    .from(schema.issues)
    .where(isNull(schema.issues.hiddenAt))
    .groupBy(schema.issues.status);

  return c.json(result);
});

const getIssueById = async (id: string) => {
  const [issue] = await db
    .select({
      id: schema.issues.id,
      companyId: schema.issues.companyId,
      executionRunId: schema.issues.executionRunId,
    })
    .from(schema.issues)
    .where(eq(schema.issues.id, id))
    .limit(1);

  return issue ?? null;
};

// GET /api/issues/:id/comments - 이슈 코멘트 목록
issuesRoute.get("/:id/comments", async (c) => {
  const id = c.req.param("id");
  const issue = await getIssueById(id);

  if (!issue) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select({
      id: schema.issueComments.id,
      companyId: schema.issueComments.companyId,
      issueId: schema.issueComments.issueId,
      authorAgentId: schema.issueComments.authorAgentId,
      authorUserId: schema.issueComments.authorUserId,
      body: schema.issueComments.body,
      createdAt: schema.issueComments.createdAt,
      updatedAt: schema.issueComments.updatedAt,
      authorAgentName: schema.agents.name,
      authorAgentIcon: schema.agents.icon,
    })
    .from(schema.issueComments)
    .leftJoin(schema.agents, eq(schema.issueComments.authorAgentId, schema.agents.id))
    .where(eq(schema.issueComments.issueId, id))
    .orderBy(asc(schema.issueComments.createdAt));

  return c.json(rows);
});

// POST /api/issues/:id/comments - 이슈 코멘트 작성
issuesRoute.post("/:id/comments", async (c) => {
  const id = c.req.param("id");
  const issue = await getIssueById(id);

  if (!issue) return c.json({ error: "Not found" }, 404);

  const payload = await c.req.json().catch(() => null);
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!body) {
    return c.json({ error: "body is required" }, 400);
  }

  const [comment] = await db
    .insert(schema.issueComments)
    .values({
      companyId: issue.companyId,
      issueId: issue.id,
      authorAgentId: typeof payload?.authorAgentId === "string" ? payload.authorAgentId : null,
      authorUserId: typeof payload?.authorUserId === "string" ? payload.authorUserId : null,
      body,
    })
    .returning();

  return c.json(comment, 201);
});

// GET /api/issues/:id/timeline - 이슈 타임라인
issuesRoute.get("/:id/timeline", async (c) => {
  const id = c.req.param("id");
  const issue = await getIssueById(id);

  if (!issue) return c.json({ error: "Not found" }, 404);

  const activityRows = await db
    .select({
      id: schema.activityLog.id,
      type: sql<string>`'activity'`,
      issueId: sql<string>`${id}`,
      createdAt: schema.activityLog.createdAt,
      action: schema.activityLog.action,
      actorType: schema.activityLog.actorType,
      actorId: schema.activityLog.actorId,
      runId: schema.activityLog.runId,
      details: schema.activityLog.details,
    })
    .from(schema.activityLog)
    .where(
      and(
        eq(schema.activityLog.entityType, "issue"),
        eq(schema.activityLog.entityId, id),
      ),
    )
    .orderBy(desc(schema.activityLog.createdAt));

  const commentRows = await db
    .select({
      id: schema.issueComments.id,
      type: sql<string>`'comment'`,
      issueId: schema.issueComments.issueId,
      createdAt: schema.issueComments.createdAt,
      action: sql<string>`'issue.comment_added'`,
      actorType: sql<string>`case when ${schema.issueComments.authorAgentId} is not null then 'agent' else 'user' end`,
      actorId: sql<string>`coalesce(${schema.issueComments.authorAgentId}::text, ${schema.issueComments.authorUserId})`,
      runId: sql<string | null>`null`,
      details: sql`jsonb_build_object(
        'body', ${schema.issueComments.body},
        'authorAgentId', ${schema.issueComments.authorAgentId},
        'authorUserId', ${schema.issueComments.authorUserId},
        'authorAgentName', ${schema.agents.name},
        'authorAgentIcon', ${schema.agents.icon}
      )`,
    })
    .from(schema.issueComments)
    .leftJoin(schema.agents, eq(schema.issueComments.authorAgentId, schema.agents.id))
    .where(eq(schema.issueComments.issueId, id))
    .orderBy(desc(schema.issueComments.createdAt));

  const approvalRows = await db
    .select({
      id: schema.approvals.id,
      type: sql<string>`'approval'`,
      issueId: schema.issueApprovals.issueId,
      createdAt: schema.approvals.createdAt,
      action: sql<string>`'approval.linked'`,
      actorType: sql<string>`case when ${schema.approvals.requestedByAgentId} is not null then 'agent' else 'user' end`,
      actorId: sql<string>`coalesce(${schema.approvals.requestedByAgentId}::text, ${schema.approvals.requestedByUserId})`,
      runId: sql<string | null>`null`,
      details: sql`jsonb_build_object(
        'approvalId', ${schema.approvals.id},
        'approvalType', ${schema.approvals.type},
        'status', ${schema.approvals.status},
        'requestedByAgentId', ${schema.approvals.requestedByAgentId},
        'requestedByUserId', ${schema.approvals.requestedByUserId},
        'payload', ${schema.approvals.payload}
      )`,
    })
    .from(schema.issueApprovals)
    .innerJoin(schema.approvals, eq(schema.issueApprovals.approvalId, schema.approvals.id))
    .where(eq(schema.issueApprovals.issueId, id))
    .orderBy(desc(schema.approvals.createdAt));

  const activityRunIds = activityRows
    .map((row) => row.runId)
    .filter((runId): runId is string => typeof runId === "string");

  const runConditions = [
    eq(sql<string>`${schema.heartbeatRuns.contextSnapshot} ->> 'issueId'`, id),
  ];

  if (issue.executionRunId) {
    runConditions.push(eq(schema.heartbeatRuns.id, issue.executionRunId));
  }

  if (activityRunIds.length > 0) {
    runConditions.push(inArray(schema.heartbeatRuns.id, activityRunIds));
  }

  const runRows = await db
    .select({
      id: schema.heartbeatRuns.id,
      type: sql<string>`'run'`,
      issueId: sql<string>`${id}`,
      createdAt: schema.heartbeatRuns.createdAt,
      action: sql<string>`'heartbeat_run'`,
      actorType: sql<string>`'agent'`,
      actorId: schema.heartbeatRuns.agentId,
      runId: schema.heartbeatRuns.id,
      details: sql`jsonb_build_object(
        'status', ${schema.heartbeatRuns.status},
        'agentId', ${schema.heartbeatRuns.agentId},
        'agentName', ${schema.agents.name},
        'agentIcon', ${schema.agents.icon},
        'invocationSource', ${schema.heartbeatRuns.invocationSource},
        'triggerDetail', ${schema.heartbeatRuns.triggerDetail},
        'startedAt', ${schema.heartbeatRuns.startedAt},
        'finishedAt', ${schema.heartbeatRuns.finishedAt},
        'contextSnapshot', coalesce(${schema.heartbeatRuns.contextSnapshot}, '{}'::jsonb) ||
          case
            when ${schema.heartbeatRuns.promptSnapshot} is null then '{}'::jsonb
            else jsonb_build_object('promptSnapshot', ${schema.heartbeatRuns.promptSnapshot})
          end,
        'promptSnapshot', ${schema.heartbeatRuns.promptSnapshot}
      )`,
    })
    .from(schema.heartbeatRuns)
    .leftJoin(schema.agents, eq(schema.heartbeatRuns.agentId, schema.agents.id))
    .where(and(eq(schema.heartbeatRuns.companyId, issue.companyId), or(...runConditions)))
    .orderBy(desc(schema.heartbeatRuns.createdAt));

  const timeline = [...activityRows, ...commentRows, ...approvalRows, ...runRows].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  return c.json(timeline);
});

// GET /api/issues - 이슈 목록 (hiddenAt이 null인 것만)
issuesRoute.get("/", async (c) => {
  const status = c.req.query("status");
  const projectId = c.req.query("projectId");
  const companyId = c.req.query("companyId");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  const conditions = [isNull(schema.issues.hiddenAt)];
  if (status) conditions.push(eq(schema.issues.status, status));
  if (projectId) conditions.push(eq(schema.issues.projectId, projectId));
  if (companyId) conditions.push(eq(schema.issues.companyId, companyId));

  const rows = await db
    .select(issueSummarySelect)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(and(...conditions))
    .orderBy(desc(schema.issues.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json(rows);
});

// GET /api/issues/:id - 이슈 상세
issuesRoute.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [row] = await db
    .select(issueSummarySelect)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(eq(schema.issues.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});
