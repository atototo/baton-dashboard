import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { db, schema } from "../db/index.js";
import { eq, desc, and, sql } from "drizzle-orm";

export const agentsRoute = new Hono();

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const toText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
};

const estimateTokens = (text: string) => Math.ceil(text.length / 4);

const getAgentById = async (id: string) => {
  const [agent] = await db
    .select({
      id: schema.agents.id,
      companyId: schema.agents.companyId,
      name: schema.agents.name,
      adapterConfig: schema.agents.adapterConfig,
      updatedAt: schema.agents.updatedAt,
    })
    .from(schema.agents)
    .where(eq(schema.agents.id, id))
    .limit(1);

  return agent ?? null;
};

const getLatestRun = async (agentId: string) => {
  const [run] = await db
    .select({
      id: schema.heartbeatRuns.id,
      agentId: schema.heartbeatRuns.agentId,
      status: schema.heartbeatRuns.status,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      error: schema.heartbeatRuns.error,
      usageJson: schema.heartbeatRuns.usageJson,
      promptSnapshot: schema.heartbeatRuns.promptSnapshot,
      contextSnapshot: schema.heartbeatRuns.contextSnapshot,
      createdAt: schema.heartbeatRuns.createdAt,
    })
    .from(schema.heartbeatRuns)
    .where(eq(schema.heartbeatRuns.agentId, agentId))
    .orderBy(desc(schema.heartbeatRuns.createdAt))
    .limit(1);

  return run ?? null;
};

const getProjectIdFromRun = (run: Awaited<ReturnType<typeof getLatestRun>>) => {
  if (!run) return null;

  const promptSnapshot = isJsonRecord(run.promptSnapshot) ? run.promptSnapshot : null;
  const layers = promptSnapshot && isJsonRecord(promptSnapshot.layers) ? promptSnapshot.layers : null;

  const promptProjectLayer = layers && isJsonRecord(layers.projectConventions) ? layers.projectConventions : null;
  const wakeLayer = layers && isJsonRecord(layers.wakeContext) ? layers.wakeContext : null;
  const contextSnapshot = isJsonRecord(run.contextSnapshot) ? run.contextSnapshot : null;
  const batonWorkspace = contextSnapshot && isJsonRecord(contextSnapshot.batonWorkspace) ? contextSnapshot.batonWorkspace : null;

  return (
    asString(promptProjectLayer?.projectId) ??
    asString(wakeLayer?.projectId) ??
    asString(contextSnapshot?.projectId) ??
    asString(batonWorkspace?.projectId) ??
    null
  );
};

const getManagedInstruction = async (agentId: string) => {
  const [instruction] = await db
    .select({
      path: schema.agentInstructions.path,
      content: schema.agentInstructions.content,
      source: schema.agentInstructions.source,
      updatedAt: schema.agentInstructions.updatedAt,
    })
    .from(schema.agentInstructions)
    .where(
      and(
        eq(schema.agentInstructions.agentId, agentId),
        eq(schema.agentInstructions.isEntryFile, true),
      ),
    )
    .limit(1);

  return instruction ?? null;
};

const readInstructionSource = async (agentId: string, adapterConfig: unknown) => {
  const config = isJsonRecord(adapterConfig) ? adapterConfig : {};
  const instructionsFilePath = asString(config.instructionsFilePath);
  const entryFile = asString(config.instructionsEntryFile) ?? (instructionsFilePath ? basename(instructionsFilePath) : null);
  const source = asString(config.instructionsBundleMode) ?? "file";

  if (source === "managed") {
    const managedInstruction = await getManagedInstruction(agentId);

    if (managedInstruction) {
      return {
        source: managedInstruction.source,
        entryFile: managedInstruction.path,
        content: managedInstruction.content,
        charCount: managedInstruction.content.length,
        updatedAt: managedInstruction.updatedAt,
      };
    }
  }

  if (!instructionsFilePath) {
    return {
      source: "missing",
      entryFile,
      content: "",
      charCount: 0,
      updatedAt: null,
    };
  }

  try {
    const [content, fileStat] = await Promise.all([
      readFile(instructionsFilePath, "utf8"),
      stat(instructionsFilePath),
    ]);

    return {
      source,
      entryFile,
      content,
      charCount: content.length,
      updatedAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return {
      source: "missing",
      entryFile,
      content: "",
      charCount: 0,
      updatedAt: null,
    };
  }
};

const getSkillLayer = async (companyId: string, latestRun: Awaited<ReturnType<typeof getLatestRun>>) => {
  const promptSnapshot = isJsonRecord(latestRun?.promptSnapshot) ? latestRun.promptSnapshot : null;
  const layers = promptSnapshot && isJsonRecord(promptSnapshot.layers) ? promptSnapshot.layers : null;
  const batonSkillLayer = layers && isJsonRecord(layers.batonSkill) ? layers.batonSkill : null;
  const skillName = asString(batonSkillLayer?.skillName) ?? "baton";

  const [skillFile] = await db
    .select({
      skillName: schema.skillFiles.skillName,
      path: schema.skillFiles.path,
      content: schema.skillFiles.content,
      updatedAt: schema.skillFiles.updatedAt,
    })
    .from(schema.skillFiles)
    .where(
      and(
        eq(schema.skillFiles.companyId, companyId),
        eq(schema.skillFiles.skillName, skillName),
        eq(schema.skillFiles.path, "SKILL.md"),
      ),
    )
    .orderBy(desc(schema.skillFiles.updatedAt))
    .limit(1);

  if (!skillFile) {
    return {
      source: "missing",
      content: "",
      metadata: { skillName, path: "SKILL.md", updatedAt: null },
    };
  }

  return {
    source: "database",
    content: skillFile.content,
    metadata: {
      skillName: skillFile.skillName,
      path: skillFile.path,
      updatedAt: skillFile.updatedAt,
    },
  };
};

const getProjectConventions = async (projectId: string | null) => {
  if (!projectId) return null;

  const [row] = await db
    .select({
      projectId: schema.projectConventions.projectId,
      conventionsMd: schema.projectConventions.conventionsMd,
      updatedAt: schema.projectConventions.updatedAt,
    })
    .from(schema.projectConventions)
    .where(eq(schema.projectConventions.projectId, projectId))
    .limit(1);

  return row ?? null;
};

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

// GET /api/agents/:id/instructions - 에이전트 지시문
agentsRoute.get("/:id/instructions", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const instructions = await readInstructionSource(agent.id, agent.adapterConfig);

  return c.json({
    agentId: id,
    source: instructions.source,
    entryFile: instructions.entryFile,
    content: instructions.content,
    charCount: instructions.charCount,
    updatedAt: instructions.updatedAt ?? agent.updatedAt,
  });
});

// GET /api/agents/:id/prompt-stack - 프롬프트 5계층
agentsRoute.get("/:id/prompt-stack", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const [instructions, latestRun] = await Promise.all([
    readInstructionSource(agent.id, agent.adapterConfig),
    getLatestRun(id),
  ]);
  const projectConventions = await getProjectConventions(getProjectIdFromRun(latestRun));
  const batonSkill = await getSkillLayer(agent.companyId, latestRun);
  const adapterConfig = isJsonRecord(agent.adapterConfig) ? agent.adapterConfig : {};
  const promptTemplateContent = asString(adapterConfig.promptTemplate) ?? "";
  const wakeContextSource =
    latestRun?.contextSnapshot ??
    (isJsonRecord(latestRun?.promptSnapshot) && isJsonRecord(latestRun.promptSnapshot.layers)
      ? latestRun.promptSnapshot.layers.wakeContext
      : null);
  const wakeContextContent = toText(wakeContextSource);

  const layers = [
    {
      order: 1,
      key: "agentInstructions",
      label: "Agent Instructions",
      source: instructions.source,
      content: instructions.content,
      metadata: { entryFile: instructions.entryFile },
    },
    {
      order: 2,
      key: "batonSkill",
      label: "Baton Skill",
      source: batonSkill.source,
      content: batonSkill.content,
      metadata: batonSkill.metadata,
    },
    {
      order: 3,
      key: "projectConventions",
      label: "Project Conventions",
      source: projectConventions ? "database" : "missing",
      content: projectConventions?.conventionsMd ?? "",
      metadata: { projectId: projectConventions?.projectId ?? getProjectIdFromRun(latestRun) },
    },
    {
      order: 4,
      key: "wakeContext",
      label: "Wake Context",
      source: latestRun ? "run_context" : "missing",
      content: wakeContextContent,
      metadata: latestRun ? { runId: latestRun.id } : null,
    },
    {
      order: 5,
      key: "promptTemplate",
      label: "Prompt Template",
      source: promptTemplateContent ? "adapter_config" : "missing",
      content: promptTemplateContent,
      metadata: null,
    },
  ].map((layer) => ({
    ...layer,
    charCount: layer.content.length,
    tokenEstimate: estimateTokens(layer.content),
  }));

  return c.json({
    agentId: id,
    composedAt: latestRun?.createdAt ?? null,
    totalChars: layers.reduce((sum, layer) => sum + layer.charCount, 0),
    layers,
  });
});

// GET /api/agents/:id/runs - 에이전트 실행 목록
agentsRoute.get("/:id/runs", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select({
      id: schema.heartbeatRuns.id,
      agentId: schema.heartbeatRuns.agentId,
      status: schema.heartbeatRuns.status,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      createdAt: schema.heartbeatRuns.createdAt,
      error: schema.heartbeatRuns.error,
      usageJson: schema.heartbeatRuns.usageJson,
    })
    .from(schema.heartbeatRuns)
    .where(eq(schema.heartbeatRuns.agentId, id))
    .orderBy(desc(schema.heartbeatRuns.createdAt))
    .limit(50);

  return c.json({
    agentId: id,
    items: rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      status: row.status,
      invocationSource: row.invocationSource,
      triggerDetail: row.triggerDetail,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      createdAt: row.createdAt,
      error: row.error,
      usage: isJsonRecord(row.usageJson) ? row.usageJson : null,
    })),
  });
});

// GET /api/agents/:id/costs - 에이전트 비용 요약
agentsRoute.get("/:id/costs", async (c) => {
  const id = c.req.param("id");
  const agent = await getAgentById(id);

  if (!agent) return c.json({ error: "Not found" }, 404);

  const [recent, grouped, summaryRows] = await Promise.all([
    db
      .select({
        provider: schema.costEvents.provider,
        model: schema.costEvents.model,
        inputTokens: schema.costEvents.inputTokens,
        outputTokens: schema.costEvents.outputTokens,
        costCents: schema.costEvents.costCents,
        occurredAt: schema.costEvents.occurredAt,
      })
      .from(schema.costEvents)
      .where(eq(schema.costEvents.agentId, id))
      .orderBy(desc(schema.costEvents.occurredAt))
      .limit(20),
    db
      .select({
        provider: schema.costEvents.provider,
        model: schema.costEvents.model,
        eventCount: sql<number>`count(*)::int`,
        totalInputTokens: sql<number>`coalesce(sum(${schema.costEvents.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${schema.costEvents.outputTokens}), 0)::int`,
        totalCostCents: sql<number>`coalesce(sum(${schema.costEvents.costCents}), 0)::int`,
      })
      .from(schema.costEvents)
      .where(eq(schema.costEvents.agentId, id))
      .groupBy(schema.costEvents.provider, schema.costEvents.model)
      .orderBy(
        desc(sql<number>`coalesce(sum(${schema.costEvents.costCents}), 0)::int`),
        desc(sql<number>`coalesce(sum(${schema.costEvents.inputTokens} + ${schema.costEvents.outputTokens}), 0)::int`),
      ),
    db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        totalInputTokens: sql<number>`coalesce(sum(${schema.costEvents.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${schema.costEvents.outputTokens}), 0)::int`,
        totalCostCents: sql<number>`coalesce(sum(${schema.costEvents.costCents}), 0)::int`,
      })
      .from(schema.costEvents)
      .where(eq(schema.costEvents.agentId, id)),
  ]);

  const [summary] = summaryRows;

  return c.json({
    agentId: id,
    summary: {
      totalEvents: summary?.totalEvents ?? 0,
      totalInputTokens: summary?.totalInputTokens ?? 0,
      totalOutputTokens: summary?.totalOutputTokens ?? 0,
      totalCostCents: summary?.totalCostCents ?? 0,
    },
    byModel: grouped,
    recent,
  });
});

// GET /api/agents/:id - 에이전트 상세
agentsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});
