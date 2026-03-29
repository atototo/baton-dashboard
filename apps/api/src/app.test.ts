import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://baton:baton@localhost:5432/baton";

const { app } = await import("./app.js");
const { closeDb, db, schema } = await import("./db/index.js");

const missingCompanyId = "00000000-0000-0000-0000-000000000000";

test("GET /api/companies returns active companies", async () => {
  const response = await app.request("/api/companies");

  assert.equal(response.status, 200);

  const companies = await response.json();

  assert.ok(Array.isArray(companies));
  assert.ok(companies.length > 0);

  for (const company of companies) {
    assert.equal(company.status, "active");
    assert.ok(company.id);
    assert.ok(company.name);
  }
});

test("existing list APIs return empty arrays for an unknown companyId", async () => {
  for (const path of ["issues", "agents", "projects"]) {
    const response = await app.request(`/api/${path}?companyId=${missingCompanyId}`);

    assert.equal(response.status, 200);

    const rows = await response.json();
    assert.deepEqual(rows, []);
  }
});

test("POST /api/issues creates an issue with generated identifier", async () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  const issuePrefix = `T${suffix.slice(0, 6).toUpperCase()}`;

  let companyId: string | null = null;
  let agentId: string | null = null;
  let issueId: string | null = null;

  try {
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: `TDD Company ${suffix}`,
        issuePrefix,
      })
      .returning({ id: schema.companies.id });

    assert.ok(company, "expected temporary company to be created");
    companyId = company.id;

    const [agent] = await db
      .insert(schema.agents)
      .values({
        companyId,
        name: `tdd-agent-${suffix}`,
      })
      .returning({ id: schema.agents.id });

    assert.ok(agent, "expected temporary agent to be created");
    agentId = agent.id;

    const response = await app.request("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        title: "Created from test",
        description: "Creates a new issue",
        priority: "high",
        assigneeAgentId: agentId,
      }),
    });

    assert.equal(response.status, 201);

    const issue = await response.json();
    issueId = issue.id;

    assert.equal(issue.title, "Created from test");
    assert.equal(issue.priority, "high");
    assert.equal(issue.status, "todo");
    assert.equal(issue.assigneeAgentId, agentId);
    assert.equal(issue.identifier, `${issuePrefix}-1`);
  } finally {
    if (issueId) {
      await db.delete(schema.issues).where(eq(schema.issues.id, issueId));
    }
    if (agentId) {
      await db.delete(schema.agents).where(eq(schema.agents.id, agentId));
    }
    if (companyId) {
      await db.delete(schema.companies).where(eq(schema.companies.id, companyId));
    }
  }
});

test("POST /api/issues returns 400 when companyId or title is missing", async () => {
  const response = await app.request("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "" }),
  });

  assert.equal(response.status, 400);
});

test.after(async () => {
  await closeDb();
});
