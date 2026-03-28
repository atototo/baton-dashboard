import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { eq, desc, and } from "drizzle-orm";

export const agentsRoute = new Hono();

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

  const [row] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});
