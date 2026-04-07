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
  const projectId = c.req.query("projectId");
  const companyId = c.req.query("companyId");

  const conditions = [isNull(schema.issues.hiddenAt)];
  if (projectId) conditions.push(eq(schema.issues.projectId, projectId));
  if (companyId) conditions.push(eq(schema.issues.companyId, companyId));

  const result = await db
    .select({
      status: schema.issues.status,
      count: count(),
    })
    .from(schema.issues)
    .where(and(...conditions))
    .groupBy(schema.issues.status);

  return c.json(result);
});

const getIssueById = async (id: string) => {
  const [issue] = await db
    .select({
      id: schema.issues.id,
      companyId: schema.issues.companyId,
      executionRunId: schema.issues.executionRunId,
      executionWorkspaceId: schema.issues.executionWorkspaceId,
    })
    .from(schema.issues)
    .where(eq(schema.issues.id, id))
    .limit(1);

  return issue ?? null;
};

const approvalTypeToKind = (type: string) => {
  switch (type) {
    case "approve_issue_plan":
      return "plan";
    case "approve_pull_request":
      return "pull_request";
    case "approve_push_to_existing_pr":
      return "push_to_existing_pr";
    case "approve_completion":
      return "completion";
    case "agent_question":
      return "question";
    default:
      return "approval";
  }
};

const isTrueLike = (value: unknown) => value === true || value === "true";

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const coalesceString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = asTrimmedString(value);
    if (normalized) return normalized;
  }

  return null;
};

const mergeContextSnapshot = (contextSnapshot: unknown, promptSnapshot: unknown) => {
  const contextRecord = asRecord(contextSnapshot) ?? {};

  if (!promptSnapshot) return contextRecord;

  return {
    ...contextRecord,
    promptSnapshot,
  };
};

const getCanonicalPlan = (approvals: Array<{
  approvalId: string;
  approvalType: string;
  approvalStatus: string;
  payload: unknown;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}>) => {
  for (let index = approvals.length - 1; index >= 0; index -= 1) {
    const approval = approvals[index];
    const payload = asRecord(approval.payload);
    const candidates = [
      { text: asTrimmedString(payload?.plan), source: "plan" },
      { text: asTrimmedString(payload?.summary), source: "summary" },
      { text: asTrimmedString(approval.decisionNote), source: "decision_note" },
    ];

    for (const candidate of candidates) {
      if (!candidate.text) continue;

      return {
        text: candidate.text,
        source: candidate.source,
        approvalId: approval.approvalId,
        approvalType: approval.approvalType,
        approvalStatus: approval.approvalStatus,
        updatedAt: approval.updatedAt ?? approval.createdAt,
      };
    }
  }

  return null;
};

const getRevisionHistory = (approvals: Array<{
  approvalId: string;
  approvalType: string;
  approvalStatus: string;
  payload: unknown;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}>) =>
  approvals
    .map((approval) => {
      const payload = asRecord(approval.payload);
      const workflowState = toWorkflowStatus({
        approvalStatus: approval.approvalStatus,
        approvalType: approval.approvalType,
        payload,
      });
      const kind = workflowState.revision
        ? "revision_requested"
        : approval.approvalStatus === "approved"
          ? "approved"
          : "submitted";
      const summary = coalesceString(payload?.summary, payload?.plan, approval.decisionNote);

      if (!summary && kind === "submitted") return null;

      return {
        approvalId: approval.approvalId,
        approvalType: approval.approvalType,
        approvalStatus: approval.approvalStatus,
        kind,
        summary,
        decisionNote: approval.decisionNote,
        createdAt: approval.createdAt,
        decidedAt: approval.decidedAt,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

const getContextDiagnostics = (promptSnapshot: unknown) => {
  const prompt = asRecord(promptSnapshot);
  const budgetStats = asRecord(prompt?.budgetStats);
  const recallStats = asRecord(prompt?.recallStats);
  const selectedRecall = asRecord(prompt?.selectedRecall);
  const recallItems = asArray(selectedRecall?.items).map((item) => asRecord(item)).filter(Boolean) as Array<
    Record<string, unknown>
  >;
  const availableChars = asNumber(budgetStats?.availableChars) ?? 0;
  const includedChars = asNumber(budgetStats?.includedChars) ?? 0;
  const droppedLayerCount = asNumber(budgetStats?.droppedLayerCount) ?? 0;
  const compactedLayerCount = asNumber(budgetStats?.compactedLayerCount) ?? 0;
  const compactedCharsSaved = asNumber(budgetStats?.compactedCharsSaved) ?? 0;
  const recallItemCount = asNumber(recallStats?.itemCount) ?? recallItems.length;
  const highestRecallScore = asNumber(recallStats?.highestScore);
  const utilization = availableChars > 0 ? includedChars / availableChars : 0;
  const highPressure = droppedLayerCount > 0 || utilization >= 0.85;
  const hasRecall = recallItemCount > 0;
  const isCompacted =
    compactedLayerCount > 0 || recallItems.some((item) => asTrimmedString(item.reason) === "compacted_context");
  const signals = [];

  if (highPressure) {
    signals.push({
      key: "high_pressure",
      label: "High pressure",
      value: utilization,
    });
  }

  if (hasRecall) {
    signals.push({
      key: "recall",
      label: "Recall",
      value: recallItemCount,
    });
  }

  if (isCompacted) {
    signals.push({
      key: "compacted",
      label: "Compacted",
      value: compactedCharsSaved,
    });
  }

  return {
    highPressure,
    hasRecall,
    isCompacted,
    availableChars,
    includedChars,
    utilization,
    droppedLayerCount,
    compactedLayerCount,
    compactedCharsSaved,
    recallItemCount,
    highestRecallScore,
    signals,
    recallItems: recallItems.map((item) => ({
      key: asString(item.key),
      kind: asString(item.kind),
      reason: asString(item.reason),
      score: asNumber(item.score),
    })),
  };
};

const toWorkflowStatus = (args: {
  approvalStatus: string;
  approvalType: string;
  payload: Record<string, unknown> | null;
}) => {
  const { approvalStatus, approvalType, payload } = args;
  const revision = approvalStatus === "rejected" || approvalStatus === "revision_requested";
  const stale =
    approvalType === "approve_push_to_existing_pr" &&
    approvalStatus === "approved" &&
    !asString(payload?.commitSha) &&
    !isTrueLike(payload?.commitCreated);
  const consumed = approvalStatus === "approved" && !revision && !stale;

  if (stale) return { status: "stale", stale, revision, consumed };
  if (revision) return { status: "revision", stale, revision, consumed };
  if (consumed) return { status: "consumed", stale, revision, consumed };
  return { status: approvalStatus, stale, revision, consumed };
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

// GET /api/issues/:id/workflow-sessions - 이슈 workflow session 타임라인
issuesRoute.get("/:id/workflow-sessions", async (c) => {
  const id = c.req.param("id");
  const issue = await getIssueById(id);

  if (!issue) return c.json({ error: "Not found" }, 404);

  const [workspace] = issue.executionWorkspaceId
    ? await db
        .select({
          id: schema.executionWorkspaces.id,
          branch: schema.executionWorkspaces.branch,
          baseBranch: schema.executionWorkspaces.baseBranch,
          lastBranchCommitSha: schema.executionWorkspaces.lastBranchCommitSha,
          pullRequestUrl: schema.executionWorkspaces.pullRequestUrl,
          pullRequestNumber: schema.executionWorkspaces.pullRequestNumber,
          prOpenedAt: schema.executionWorkspaces.prOpenedAt,
          lastPrCheckedAt: schema.executionWorkspaces.lastPrCheckedAt,
        })
        .from(schema.executionWorkspaces)
        .where(eq(schema.executionWorkspaces.id, issue.executionWorkspaceId))
        .limit(1)
    : [];

  const approvalRows = await db
    .select({
      approvalId: schema.approvals.id,
      approvalType: schema.approvals.type,
      approvalStatus: schema.approvals.status,
      payload: schema.approvals.payload,
      decisionNote: schema.approvals.decisionNote,
      requestedByAgentId: schema.approvals.requestedByAgentId,
      requestedByUserId: schema.approvals.requestedByUserId,
      createdAt: schema.approvals.createdAt,
      updatedAt: schema.approvals.updatedAt,
      decidedAt: schema.approvals.decidedAt,
    })
    .from(schema.issueApprovals)
    .innerJoin(schema.approvals, eq(schema.issueApprovals.approvalId, schema.approvals.id))
    .where(eq(schema.issueApprovals.issueId, id))
    .orderBy(asc(schema.approvals.createdAt));

  const runRows = await db
    .select({
      id: schema.heartbeatRuns.id,
      status: schema.heartbeatRuns.status,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      createdAt: schema.heartbeatRuns.createdAt,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      contextSnapshot: schema.heartbeatRuns.contextSnapshot,
      promptSnapshot: schema.heartbeatRuns.promptSnapshot,
    })
    .from(schema.heartbeatRuns)
    .where(
      and(
        eq(schema.heartbeatRuns.companyId, issue.companyId),
        or(
          eq(sql<string>`${schema.heartbeatRuns.contextSnapshot} ->> 'issueId'`, id),
          issue.executionRunId ? eq(schema.heartbeatRuns.id, issue.executionRunId) : undefined,
        ),
      ),
    )
    .orderBy(asc(schema.heartbeatRuns.createdAt));

  const latestDiagnosticRunOverall =
    [...runRows].reverse().find((run) => run.promptSnapshot || run.contextSnapshot) ?? null;

  const sessions = approvalRows.map((approval, index) => {
    const nextApproval = approvalRows[index + 1];
    const payload = asRecord(approval.payload);
    const workflowState = toWorkflowStatus({
      approvalStatus: approval.approvalStatus,
      approvalType: approval.approvalType,
      payload,
    });
    const sessionRuns = runRows.filter((run) => {
      if (run.createdAt < approval.createdAt) return false;
      if (!nextApproval) return true;
      return run.createdAt < nextApproval.createdAt;
    });
    const latestRun = sessionRuns.at(-1) ?? null;
    const diagnosticRun =
      [...sessionRuns].reverse().find((run) => run.promptSnapshot || run.contextSnapshot) ??
      latestDiagnosticRunOverall ??
      latestRun;
    const isLatest = index === approvalRows.length - 1;
    const approvalsThroughCurrent = approvalRows.slice(0, index + 1);
    const mergedContextSnapshot = mergeContextSnapshot(
      diagnosticRun?.contextSnapshot ?? latestRun?.contextSnapshot ?? null,
      diagnosticRun?.promptSnapshot ?? null,
    );
    const branch = coalesceString(payload?.branch, workspace?.branch);
    const baseBranch = coalesceString(payload?.baseBranch, workspace?.baseBranch);
    const commitSha = coalesceString(payload?.commitSha, isLatest ? workspace?.lastBranchCommitSha : null);
    const pullRequestUrl = coalesceString(payload?.pullRequestUrl, isLatest ? workspace?.pullRequestUrl : null);
    const pullRequestNumber =
      asNumber(payload?.pullRequestNumber) ?? asNumber(isLatest ? workspace?.pullRequestNumber : null);

    return {
      id: approval.approvalId,
      issueId: id,
      approvalId: approval.approvalId,
      approvalType: approval.approvalType,
      approvalStatus: approval.approvalStatus,
      kind: approvalTypeToKind(approval.approvalType),
      status: workflowState.status,
      epoch: index + 1,
      stale: workflowState.stale,
      revision: workflowState.revision,
      consumed: workflowState.consumed,
      branch,
      baseBranch,
      commitSha,
      pullRequestUrl,
      pullRequestNumber,
      prOpenedAt: coalesceString(payload?.prOpenedAt, isLatest ? workspace?.prOpenedAt : null),
      lastPrCheckedAt: isLatest ? workspace?.lastPrCheckedAt ?? null : null,
      canonicalPlan: getCanonicalPlan(approvalsThroughCurrent),
      revisionHistory: getRevisionHistory(approvalsThroughCurrent),
      diff: {
        available: Boolean(branch && baseBranch && (commitSha || pullRequestUrl || pullRequestNumber)),
        branch,
        baseBranch,
        commitSha,
        pullRequestUrl,
        pullRequestNumber,
      },
      requestedByAgentId: approval.requestedByAgentId,
      requestedByUserId: approval.requestedByUserId,
      runId: latestRun?.id ?? null,
      runStatus: latestRun?.status ?? null,
      runInvocationSource: latestRun?.invocationSource ?? null,
      runTriggerDetail: latestRun?.triggerDetail ?? null,
      runStartedAt: latestRun?.startedAt ?? null,
      runFinishedAt: latestRun?.finishedAt ?? null,
      runCount: sessionRuns.length,
      contextSnapshot: mergedContextSnapshot,
      contextDiagnostics: getContextDiagnostics(diagnosticRun?.promptSnapshot ?? null),
      decisionNote: approval.decisionNote,
      createdAt: approval.createdAt,
      decidedAt: approval.decidedAt,
      updatedAt: approval.updatedAt,
    };
  });

  return c.json(sessions.sort((left, right) => right.epoch - left.epoch));
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
  const parentId = c.req.query("parentId");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  const conditions = [isNull(schema.issues.hiddenAt)];
  if (status) conditions.push(eq(schema.issues.status, status));
  if (projectId) conditions.push(eq(schema.issues.projectId, projectId));
  if (companyId) conditions.push(eq(schema.issues.companyId, companyId));
  if (parentId) conditions.push(eq(schema.issues.parentId, parentId));

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

// PATCH /api/issues/:id - 이슈 상태 수정
issuesRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const payload = await c.req.json().catch(() => null);
  const status = typeof payload?.status === "string" ? payload.status.trim() : "";

  if (!status) {
    return c.json({ error: "status is required" }, 400);
  }

  const [updatedIssue] = await db
    .update(schema.issues)
    .set({
      status,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.issues.id, id))
    .returning({
      id: schema.issues.id,
    });

  if (!updatedIssue) {
    return c.json({ error: "Not found" }, 404);
  }

  const [row] = await db
    .select(issueSummarySelect)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(eq(schema.issues.id, id))
    .limit(1);

  return c.json(row);
});

// POST /api/issues - 이슈 생성
issuesRoute.post("/", async (c) => {
  const payload = await c.req.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const companyId = typeof payload?.companyId === "string" ? payload.companyId.trim() : "";

  if (!title) return c.json({ error: "title is required" }, 400);
  if (!companyId) return c.json({ error: "companyId is required" }, 400);

  const projectId = typeof payload?.projectId === "string" ? payload.projectId : null;
  const parentId = typeof payload?.parentId === "string" ? payload.parentId : null;
  const priority = typeof payload?.priority === "string" ? payload.priority : "medium";
  const description = typeof payload?.description === "string" ? payload.description : null;

  const [inserted] = await db
    .insert(schema.issues)
    .values({
      title,
      companyId,
      projectId,
      parentId,
      priority,
      description,
      status: "backlog",
      createdByUserId: "dashboard-user",
      requestDepth: 0,
    })
    .returning({ id: schema.issues.id });

  if (!inserted) return c.json({ error: "Failed to create issue" }, 500);

  const [row] = await db
    .select(issueSummarySelect)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(eq(schema.issues.id, inserted.id))
    .limit(1);

  return c.json(row, 201);
});
