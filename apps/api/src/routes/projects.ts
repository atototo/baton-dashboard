import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc, isNull, and, count } from "drizzle-orm";

export const projectsRoute = new Hono();

// GET /api/projects - 프로젝트 목록 (archived 제외)
projectsRoute.get("/", async (c) => {
  const companyId = c.req.query("companyId");

  const conditions = [isNull(schema.projects.archivedAt)];
  if (companyId) conditions.push(eq(schema.projects.companyId, companyId));

  const rows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      description: schema.projects.description,
      status: schema.projects.status,
      color: schema.projects.color,
      leadAgentId: schema.projects.leadAgentId,
      targetDate: schema.projects.targetDate,
      createdAt: schema.projects.createdAt,
      leadAgentName: schema.agents.name,
      leadAgentIcon: schema.agents.icon,
    })
    .from(schema.projects)
    .leftJoin(schema.agents, eq(schema.projects.leadAgentId, schema.agents.id))
    .where(and(...conditions))
    .orderBy(desc(schema.projects.updatedAt));

  return c.json(rows);
});

// GET /api/projects/:id - 프로젝트 상세
projectsRoute.get("/:id", async (c) => {
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// GET /api/projects/:id/stats - 프로젝트 이슈 통계
projectsRoute.get("/:id/stats", async (c) => {
  const id = c.req.param("id");

  const rows = await db
    .select({
      status: schema.issues.status,
      count: count(),
    })
    .from(schema.issues)
    .where(and(eq(schema.issues.projectId, id), isNull(schema.issues.hiddenAt)))
    .groupBy(schema.issues.status);

  return c.json({
    total: rows.reduce((sum, row) => sum + row.count, 0),
    byStatus: Object.fromEntries(rows.map((row) => [row.status, row.count])),
  });
});
