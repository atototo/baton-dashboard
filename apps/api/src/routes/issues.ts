import { Hono } from "hono";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export const issuesRoute = new Hono();

const issueListSelection = {
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
};

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
    .select(issueListSelection)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(and(...conditions))
    .orderBy(desc(schema.issues.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json(rows);
});

// POST /api/issues - 이슈 생성
issuesRoute.post("/", async (c) => {
  const payload = await c.req.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const companyId = typeof payload.companyId === "string" ? payload.companyId : "";
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : null;
  const priority =
    typeof payload.priority === "string" && payload.priority.trim()
      ? payload.priority
      : "medium";
  const projectId =
    typeof payload.projectId === "string" && payload.projectId.trim()
      ? payload.projectId
      : null;
  const assigneeAgentId =
    typeof payload.assigneeAgentId === "string" && payload.assigneeAgentId.trim()
      ? payload.assigneeAgentId
      : null;

  if (!companyId) return c.json({ error: "companyId is required" }, 400);
  if (!title) return c.json({ error: "title is required" }, 400);

  const issueId = await db.transaction(async (tx) => {
    const [company] = await tx
      .update(schema.companies)
      .set({
        issueCounter: sql`${schema.companies.issueCounter} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.companies.id, companyId))
      .returning({
        issuePrefix: schema.companies.issuePrefix,
        issueCounter: schema.companies.issueCounter,
      });

    if (!company) {
      return null;
    }

    const [insertedIssue] = await tx
      .insert(schema.issues)
      .values({
        companyId,
        projectId,
        title,
        description: description || null,
        priority,
        assigneeAgentId,
        status: assigneeAgentId ? "todo" : "backlog",
        identifier: `${company.issuePrefix}-${company.issueCounter}`,
      })
      .returning({ id: schema.issues.id });

    return insertedIssue?.id ?? null;
  });

  if (!issueId) {
    return c.json({ error: "Company not found" }, 404);
  }

  const [createdIssue] = await db
    .select(issueListSelection)
    .from(schema.issues)
    .leftJoin(schema.agents, eq(schema.issues.assigneeAgentId, schema.agents.id))
    .leftJoin(schema.projects, eq(schema.issues.projectId, schema.projects.id))
    .where(eq(schema.issues.id, issueId))
    .limit(1);

  if (!createdIssue) {
    return c.json({ error: "Failed to create issue" }, 500);
  }

  return c.json(createdIssue, 201);
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
