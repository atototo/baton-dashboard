import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { count, eq, isNull, sql } from "drizzle-orm";

export const statsRoute = new Hono();

// GET /api/stats/overview - 전체 현황 요약
statsRoute.get("/overview", async (c) => {
  const [issueStats] = await db
    .select({
      total: count(),
      backlog: count(sql`CASE WHEN ${schema.issues.status} = 'backlog' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${schema.issues.status} = 'in_progress' THEN 1 END`),
      inReview: count(sql`CASE WHEN ${schema.issues.status} = 'in_review' THEN 1 END`),
      completed: count(sql`CASE WHEN ${schema.issues.status} = 'completed' THEN 1 END`),
      cancelled: count(sql`CASE WHEN ${schema.issues.status} = 'cancelled' THEN 1 END`),
    })
    .from(schema.issues)
    .where(isNull(schema.issues.hiddenAt));

  const [agentStats] = await db
    .select({
      total: count(),
      active: count(sql`CASE WHEN ${schema.agents.status} = 'active' THEN 1 END`),
      idle: count(sql`CASE WHEN ${schema.agents.status} = 'idle' THEN 1 END`),
    })
    .from(schema.agents);

  const [projectStats] = await db
    .select({ total: count() })
    .from(schema.projects)
    .where(isNull(schema.projects.archivedAt));

  const [companyStats] = await db
    .select({ total: count() })
    .from(schema.companies);

  return c.json({
    issues: issueStats,
    agents: agentStats,
    projects: projectStats,
    companies: companyStats,
  });
});
