import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db, schema } from "../db/index.js";

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
