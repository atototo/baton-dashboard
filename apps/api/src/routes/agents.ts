import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export const agentsRoute = new Hono();

const BATON_SKILL_SUMMARY = [
  "# Baton Skill",
  "",
  "- 하트비트 기반으로 할당 이슈를 조회하고 checkout 후 작업한다.",
  "- 작업 완료 시 코멘트를 남기고 board user에게 in_review 로 제출한다.",
  "- 블로커 발생 시 blocked 상태와 필요한 조치를 코멘트에 남긴다.",
].join("\n");

const estimateTokens = (content: string) => Math.ceil(content.length / 4);

const buildProjectConventionsContent = (conventions: {
  backstory: string;
  conventionsMd: string;
  compactContext: string | null;
}) =>
  [
    conventions.backstory ? `# Backstory\n\n${conventions.backstory}` : "",
    conventions.conventionsMd ? `# Conventions\n\n${conventions.conventionsMd}` : "",
    conventions.compactContext ? `# Compact Context\n\n${conventions.compactContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

const getAgentById = async (id: string) => {
  const [agent] = await db.select().from(schema.agents).where(eq(schema.agents.id, id)).limit(1);
  return agent ?? null;
};

const getInstructionsBundle = async (agentId: string) => {
  const files = await db
    .select({
      path: schema.agentInstructions.path,
      content: schema.agentInstructions.content,
      isEntryFile: schema.agentInstructions.isEntryFile,
      source: schema.agentInstructions.source,
      updatedAt: schema.agentInstructions.updatedAt,
    })
    .from(schema.agentInstructions)
    .where(eq(schema.agentInstructions.agentId, agentId))
    .orderBy(desc(schema.agentInstructions.isEntryFile), schema.agentInstructions.path);

  const entryFile = files.find((file) => file.isEntryFile) ?? files[0] ?? null;
  const bundleText = files.map((file) => `# ${file.path}\n\n${file.content}`).join("\n\n");

  return {
    entryFilePath: entryFile?.path ?? null,
    bundleText,
    files: files.map((file) => ({
      ...file,
      charCount: file.content.length,
      estimatedTokens: estimateTokens(file.content),
    })),
  };
};

const getLatestRun = async (agentId: string) => {
  const [run] = await db
    .select({
      id: schema.heartbeatRuns.id,
      status: schema.heartbeatRuns.status,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      createdAt: schema.heartbeatRuns.createdAt,
      contextSnapshot: schema.heartbeatRuns.contextSnapshot,
      promptSnapshot: schema.heartbeatRuns.promptSnapshot,
      stdoutExcerpt: schema.heartbeatRuns.stdoutExcerpt,
      stderrExcerpt: schema.heartbeatRuns.stderrExcerpt,
      error: schema.heartbeatRuns.error,
    })
    .from(schema.heartbeatRuns)
    .where(eq(schema.heartbeatRuns.agentId, agentId))
    .orderBy(desc(schema.heartbeatRuns.createdAt))
    .limit(1);

  return run ?? null;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

// GET /api/agents - 에이전트 목록
agentsRoute.get("/", async (c) => {
  const companyId = c.req.query("companyId");

  const conditions = [];
  if (companyId) conditions.push(eq(schema.agents.companyId, companyId));

  const rows = await db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      role: schema.agents.role,
      title: schema.agents.title,
      status: schema.agents.status,
      icon: schema.agents.icon,
      companyId: schema.agents.companyId,
      reportsTo: schema.agents.reportsTo,
      lastHeartbeatAt: schema.agents.lastHeartbeatAt,
      createdAt: schema.agents.createdAt,
    })
    .from(schema.agents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.agents.updatedAt));

  return c.json(rows);
});

// GET /api/agents/:id - 에이전트 상세
agentsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);
  return c.json(agent);
});

// GET /api/agents/:id/instructions - 에이전트 지시문 번들
agentsRoute.get("/:id/instructions", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const bundle = await getInstructionsBundle(id);

  return c.json({
    agentId: agent.id,
    agentName: agent.name,
    entryFilePath: bundle.entryFilePath,
    fileCount: bundle.files.length,
    bundleText: bundle.bundleText,
    bundleCharCount: bundle.bundleText.length,
    bundleEstimatedTokens: estimateTokens(bundle.bundleText),
    files: bundle.files,
  });
});

// GET /api/agents/:id/prompt-stack - 프롬프트 5계층
agentsRoute.get("/:id/prompt-stack", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const instructions = await getInstructionsBundle(id);
  const latestRun = await getLatestRun(id);
  const contextSnapshot = asRecord(latestRun?.contextSnapshot);
  const agentConfig = asRecord(agent.adapterConfig);
  const projectIdFromContext =
    typeof contextSnapshot.projectId === "string" ? contextSnapshot.projectId : null;
  const issueIdFromContext = typeof contextSnapshot.issueId === "string" ? contextSnapshot.issueId : null;

  let projectId = projectIdFromContext;
  if (!projectId && issueIdFromContext) {
    const [issue] = await db
      .select({ projectId: schema.issues.projectId })
      .from(schema.issues)
      .where(eq(schema.issues.id, issueIdFromContext))
      .limit(1);
    projectId = issue?.projectId ?? null;
  }

  const [conventions] = projectId
    ? await db
        .select({
          projectId: schema.projectConventions.projectId,
          conventionsMd: schema.projectConventions.conventionsMd,
          backstory: schema.projectConventions.backstory,
          compactContext: schema.projectConventions.compactContext,
          updatedAt: schema.projectConventions.updatedAt,
        })
        .from(schema.projectConventions)
        .where(eq(schema.projectConventions.projectId, projectId))
        .limit(1)
    : [];

  const projectConventionsText = conventions ? buildProjectConventionsContent(conventions) : "";
  const wakeContextText = JSON.stringify(contextSnapshot, null, 2);
  const promptTemplate = typeof agentConfig.promptTemplate === "string" ? agentConfig.promptTemplate : "";

  const layers = [
    {
      order: 1,
      key: "agent_instructions",
      label: "Agent Instructions",
      source: instructions.files[0]?.source ?? "managed",
      content: instructions.bundleText,
      charCount: instructions.bundleText.length,
      estimatedTokens: estimateTokens(instructions.bundleText),
      meta: {
        entryFilePath: instructions.entryFilePath,
        fileCount: instructions.files.length,
      },
    },
    {
      order: 2,
      key: "baton_skill",
      label: "Baton Skill",
      source: "fixed",
      content: BATON_SKILL_SUMMARY,
      charCount: BATON_SKILL_SUMMARY.length,
      estimatedTokens: estimateTokens(BATON_SKILL_SUMMARY),
      meta: null,
    },
    {
      order: 3,
      key: "project_conventions",
      label: "Project Conventions",
      source: conventions ? "db" : "missing",
      content: projectConventionsText,
      charCount: projectConventionsText.length,
      estimatedTokens: estimateTokens(projectConventionsText),
      meta: conventions
        ? {
            projectId: conventions.projectId,
            updatedAt: conventions.updatedAt,
          }
        : null,
    },
    {
      order: 4,
      key: "wake_context",
      label: "Wake Context",
      source: latestRun ? "heartbeat_runs.context_snapshot" : "missing",
      content: wakeContextText,
      charCount: wakeContextText.length,
      estimatedTokens: estimateTokens(wakeContextText),
      meta: latestRun
        ? {
            runId: latestRun.id,
            status: latestRun.status,
            invocationSource: latestRun.invocationSource,
            triggerDetail: latestRun.triggerDetail,
          }
        : null,
    },
    {
      order: 5,
      key: "prompt_template",
      label: "Prompt Template",
      source: "agents.adapter_config.promptTemplate",
      content: promptTemplate,
      charCount: promptTemplate.length,
      estimatedTokens: estimateTokens(promptTemplate),
      meta: null,
    },
  ];

  return c.json({
    agentId: agent.id,
    agentName: agent.name,
    layers,
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          invocationSource: latestRun.invocationSource,
          triggerDetail: latestRun.triggerDetail,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
        }
      : null,
  });
});

// GET /api/agents/:id/runs - 에이전트 실행 기록
agentsRoute.get("/:id/runs", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const requestedLimit = Number(c.req.query("limit") ?? "20");
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;

  const runs = await db
    .select({
      id: schema.heartbeatRuns.id,
      status: schema.heartbeatRuns.status,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      createdAt: schema.heartbeatRuns.createdAt,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      stdoutExcerpt: schema.heartbeatRuns.stdoutExcerpt,
      stderrExcerpt: schema.heartbeatRuns.stderrExcerpt,
      error: schema.heartbeatRuns.error,
      errorCode: schema.heartbeatRuns.errorCode,
      logBytes: schema.heartbeatRuns.logBytes,
    })
    .from(schema.heartbeatRuns)
    .where(eq(schema.heartbeatRuns.agentId, id))
    .orderBy(desc(schema.heartbeatRuns.createdAt))
    .limit(limit);

  return c.json({
    agentId: agent.id,
    agentName: agent.name,
    limit,
    runs: runs.map((run) => ({
      id: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
      invocationSource: run.invocationSource,
      triggerDetail: run.triggerDetail,
      excerpt: run.stderrExcerpt ?? run.stdoutExcerpt ?? run.error ?? null,
      stdoutExcerpt: run.stdoutExcerpt,
      stderrExcerpt: run.stderrExcerpt,
      errorCode: run.errorCode,
      logBytes: run.logBytes,
    })),
  });
});

// GET /api/agents/:id/costs - 에이전트 비용/토큰 집계
agentsRoute.get("/:id/costs", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const [totals] = await db
    .select({
      inputTokens: sql<number>`coalesce(sum(${schema.costEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${schema.costEvents.outputTokens}), 0)::int`,
      costCents: sql<number>`coalesce(sum(${schema.costEvents.costCents}), 0)::int`,
      eventCount: sql<number>`count(*)::int`,
      firstOccurredAt: sql<string | null>`min(${schema.costEvents.occurredAt})`,
      lastOccurredAt: sql<string | null>`max(${schema.costEvents.occurredAt})`,
    })
    .from(schema.costEvents)
    .where(eq(schema.costEvents.agentId, id));

  return c.json({
    agentId: agent.id,
    agentName: agent.name,
    totals: {
      inputTokens: totals?.inputTokens ?? 0,
      outputTokens: totals?.outputTokens ?? 0,
      costCents: totals?.costCents ?? 0,
      costUsd: Number(((totals?.costCents ?? 0) / 100).toFixed(2)),
      eventCount: totals?.eventCount ?? 0,
    },
    window: {
      firstOccurredAt: totals?.firstOccurredAt ?? null,
      lastOccurredAt: totals?.lastOccurredAt ?? null,
    },
  });
});
