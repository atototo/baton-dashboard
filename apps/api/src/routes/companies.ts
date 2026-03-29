import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "../db/index.js";
import { createIssue } from "./issues.js";

export const companiesRoute = new Hono();

// GET /api/companies - 활성 회사 목록
companiesRoute.get("/", async (c) => {
  const rows = await db
    .select({
      id: schema.companies.id,
      name: schema.companies.name,
      description: schema.companies.description,
      status: schema.companies.status,
      issuePrefix: schema.companies.issuePrefix,
      brandColor: schema.companies.brandColor,
    })
    .from(schema.companies)
    .where(and(eq(schema.companies.status, "active")));

  return c.json(rows);
});

// POST /api/companies/:companyId/issues - 회사 범위 이슈 생성
companiesRoute.post("/:companyId/issues", async (c) => {
  const payload = await c.req.json().catch(() => null);

  if (!payload || typeof payload !== "object") {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const result = await createIssue(payload, c.req.param("companyId"));

  if ("error" in result) {
    return c.json({ error: result.error }, result.status);
  }

  return c.json(result.issue, result.status);
});
