import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc, and, sql, count, isNull } from "drizzle-orm";

export const issuesRoute = new Hono();

// GET /api/issues - 이슈 목록 (hiddenAt이 null인 것만)
issuesRoute.get("/", async (c) => {
  const status = c.req.query("status");
  const projectId = c.req.query("projectId");
  const limit = Number(c.req.query("limit")) || 50;
  const offset = Number(c.req.query("offset")) || 0;

  const conditions = [isNull(schema.issues.hiddenAt)];
  if (status) conditions.push(eq(schema.issues.status, status));
  if (projectId) conditions.push(eq(schema.issues.projectId, projectId));

  const rows = await db
    .select({
      id: schema.issues.id,
      title: schema.issues.title,
      status: schema.issues.status,
      priority: schema.issues.priority,
      identifier: schema.issues.identifier,
      projectId: schema.issues.projectId,
      assigneeAgentId: schema.issues.assigneeAgentId,
      parentId: schema.issues.parentId,
      createdAt: schema.issues.createdAt,
      updatedAt: schema.issues.updatedAt,
      startedAt: schema.issues.startedAt,
      completedAt: schema.issues.completedAt,
      agentName: schema.agents.name,
      agentIcon: schema.agents.icon,
      projectName: schema.projects.name,
    })
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
    .select()
    .from(schema.issues)
    .where(eq(schema.issues.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

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
