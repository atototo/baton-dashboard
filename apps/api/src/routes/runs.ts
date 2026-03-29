import { Hono } from "hono";
import { eq, asc, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export const runsRoute = new Hono();

// GET /api/runs/:id/prompt-snapshot - 실행 프롬프트 스냅샷
runsRoute.get("/:id/prompt-snapshot", async (c) => {
  const id = c.req.param("id");

  const [run] = await db
    .select({
      runId: schema.heartbeatRuns.id,
      companyId: schema.heartbeatRuns.companyId,
      agentId: schema.heartbeatRuns.agentId,
      status: schema.heartbeatRuns.status,
      invocationSource: schema.heartbeatRuns.invocationSource,
      triggerDetail: schema.heartbeatRuns.triggerDetail,
      startedAt: schema.heartbeatRuns.startedAt,
      finishedAt: schema.heartbeatRuns.finishedAt,
      createdAt: schema.heartbeatRuns.createdAt,
      contextSnapshot: schema.heartbeatRuns.contextSnapshot,
      promptSnapshot: schema.heartbeatRuns.promptSnapshot,
      agentName: schema.agents.name,
      agentIcon: schema.agents.icon,
    })
    .from(schema.heartbeatRuns)
    .leftJoin(schema.agents, eq(schema.heartbeatRuns.agentId, schema.agents.id))
    .where(eq(schema.heartbeatRuns.id, id))
    .limit(1);

  if (!run) return c.json({ error: "Not found" }, 404);

  return c.json(run);
});

// GET /api/runs/:id/events - 실행 이벤트 목록
runsRoute.get("/:id/events", async (c) => {
  const id = c.req.param("id");

  const [run] = await db
    .select({ id: schema.heartbeatRuns.id })
    .from(schema.heartbeatRuns)
    .where(eq(schema.heartbeatRuns.id, id))
    .limit(1);

  if (!run) return c.json({ error: "Not found" }, 404);

  const rows = await db
    .select({
      id: sql<string>`${schema.heartbeatRunEvents.id}::text`,
      runId: schema.heartbeatRunEvents.runId,
      companyId: schema.heartbeatRunEvents.companyId,
      agentId: schema.heartbeatRunEvents.agentId,
      seq: schema.heartbeatRunEvents.seq,
      eventType: schema.heartbeatRunEvents.eventType,
      stream: schema.heartbeatRunEvents.stream,
      level: schema.heartbeatRunEvents.level,
      color: schema.heartbeatRunEvents.color,
      message: schema.heartbeatRunEvents.message,
      payload: schema.heartbeatRunEvents.payload,
      createdAt: schema.heartbeatRunEvents.createdAt,
    })
    .from(schema.heartbeatRunEvents)
    .where(eq(schema.heartbeatRunEvents.runId, id))
    .orderBy(asc(schema.heartbeatRunEvents.seq), asc(schema.heartbeatRunEvents.createdAt));

  return c.json(rows);
});
