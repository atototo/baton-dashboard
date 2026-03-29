import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { eq, sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://baton:baton@localhost:5432/baton";

const { app } = await import("./app.js");
const { closeDb, db, schema } = await import("./db/index.js");

const missingCompanyId = "00000000-0000-0000-0000-000000000000";
const issueIdentifier = "DOB-147";
const srcDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(srcDir, "..");

const getIssueByIdentifier = async () => {
  const [issue] = await db
    .select({
      id: schema.issues.id,
      companyId: schema.issues.companyId,
    })
    .from(schema.issues)
    .where(eq(schema.issues.identifier, issueIdentifier))
    .limit(1);

  assert.ok(issue, `${issueIdentifier} should exist in the shared Baton DB`);
  return issue;
};

const getRunWithPromptSnapshot = async () => {
  const result = await db.execute(sql`
    select id
    from heartbeat_runs
    where prompt_snapshot is not null
    order by created_at desc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string }>;
  assert.ok(row?.id, "a run with prompt_snapshot should exist");
  return row.id;
};

const getRunWithEvents = async () => {
  const result = await db.execute(sql`
    select run_id as id
    from heartbeat_run_events
    group by run_id
    having count(*) > 0
    order by max(created_at) desc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string }>;
  assert.ok(row?.id, "a run with events should exist");
  return row.id;
};

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

test("POST /api/companies/:companyId/issues creates an issue and preserves projectId", async () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  const issuePrefix = `T${suffix.slice(0, 6).toUpperCase()}`;

  let companyId: string | null = null;
  let projectId: string | null = null;
  let issueId: string | null = null;

  try {
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: `Scoped Company ${suffix}`,
        issuePrefix,
      })
      .returning({ id: schema.companies.id });

    assert.ok(company, "expected temporary company to be created");
    companyId = company.id;

    const [project] = await db
      .insert(schema.projects)
      .values({
        companyId,
        name: `Scoped Project ${suffix}`,
      })
      .returning({ id: schema.projects.id });

    assert.ok(project, "expected temporary project to be created");
    projectId = project.id;

    const response = await app.request(`/api/companies/${companyId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Created from company-scoped route",
        description: "Creates a new issue through the company route",
        projectId,
      }),
    });

    assert.equal(response.status, 201);

    const issue = await response.json();
    issueId = issue.id;

    assert.equal(issue.companyId, companyId);
    assert.equal(issue.projectId, projectId);
    assert.equal(issue.title, "Created from company-scoped route");
    assert.equal(issue.status, "backlog");
    assert.equal(issue.identifier, `${issuePrefix}-1`);
  } finally {
    if (issueId) {
      await db.delete(schema.issues).where(eq(schema.issues.id, issueId));
    }
    if (projectId) {
      await db.delete(schema.projects).where(eq(schema.projects.id, projectId));
    }
    if (companyId) {
      await db.delete(schema.companies).where(eq(schema.companies.id, companyId));
    }
  }
});

test("POST /api/companies/:companyId/issues creates a child issue when parentId is provided", async () => {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  const issuePrefix = `T${suffix.slice(0, 6).toUpperCase()}`;

  let companyId: string | null = null;
  let parentIssueId: string | null = null;
  let childIssueId: string | null = null;

  try {
    const [company] = await db
      .insert(schema.companies)
      .values({
        name: `Child Company ${suffix}`,
        issuePrefix,
      })
      .returning({ id: schema.companies.id });

    assert.ok(company, "expected temporary company to be created");
    companyId = company.id;

    const [parentIssue] = await db
      .insert(schema.issues)
      .values({
        companyId,
        title: "Parent issue",
        status: "todo",
        priority: "medium",
        identifier: `${issuePrefix}-1`,
        issueNumber: 1,
      })
      .returning({ id: schema.issues.id });

    assert.ok(parentIssue, "expected parent issue to be created");
    parentIssueId = parentIssue.id;

    await db
      .update(schema.companies)
      .set({
        issueCounter: 1,
      })
      .where(eq(schema.companies.id, companyId));

    const response = await app.request(`/api/companies/${companyId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Child issue",
        parentId: parentIssueId,
      }),
    });

    assert.equal(response.status, 201);

    const childIssue = await response.json();
    childIssueId = childIssue.id;

    assert.equal(childIssue.companyId, companyId);
    assert.equal(childIssue.parentId, parentIssueId);
    assert.equal(childIssue.title, "Child issue");
    assert.equal(childIssue.identifier, `${issuePrefix}-2`);
  } finally {
    if (childIssueId) {
      await db.delete(schema.issues).where(eq(schema.issues.id, childIssueId));
    }
    if (parentIssueId) {
      await db.delete(schema.issues).where(eq(schema.issues.id, parentIssueId));
    }
    if (companyId) {
      await db.delete(schema.companies).where(eq(schema.companies.id, companyId));
    }
  }
});

test("GET /api/issues/:id/comments returns the issue comment thread", async () => {
  const issue = await getIssueByIdentifier();

  const response = await app.request(`/api/issues/${issue.id}/comments`);

  assert.equal(response.status, 200);

  const comments = await response.json();
  assert.ok(Array.isArray(comments));
  assert.ok(comments.length > 0);
  assert.equal(comments[0].issueId, issue.id);
  assert.equal(typeof comments[0].body, "string");
});

test("POST /api/issues/:id/comments creates a new issue comment", async () => {
  const issue = await getIssueByIdentifier();
  const body = `app test comment ${Date.now()}`;

  const response = await app.request(`/api/issues/${issue.id}/comments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      body,
      authorAgentId: "8aeedf76-3692-43d6-a1a7-cbf9b9560ce9",
    }),
  });

  assert.equal(response.status, 201);

  const comment = await response.json();
  assert.equal(comment.issueId, issue.id);
  assert.equal(comment.companyId, issue.companyId);
  assert.equal(comment.body, body);
  assert.ok(comment.id);

  await db.delete(schema.issueComments).where(eq(schema.issueComments.id, comment.id));
});

test("GET /api/issues/:id/timeline returns merged timeline events", async () => {
  const issue = await getIssueByIdentifier();

  const response = await app.request(`/api/issues/${issue.id}/timeline`);

  assert.equal(response.status, 200);

  const timeline = await response.json();
  assert.ok(Array.isArray(timeline));
  assert.ok(timeline.length > 0);
  assert.equal(timeline[0].issueId, issue.id);
  assert.ok(["activity", "comment", "approval", "run"].includes(timeline[0].type));
});

test("GET /api/issues/:id returns assignee and project metadata", async () => {
  const issue = await getIssueByIdentifier();

  const response = await app.request(`/api/issues/${issue.id}`);

  assert.equal(response.status, 200);

  const detail = await response.json();
  assert.equal(detail.id, issue.id);
  assert.ok("agentName" in detail);
  assert.ok("agentIcon" in detail);
  assert.ok("projectName" in detail);
});

test("GET /api/issues/:id/timeline includes prompt snapshot data for run events", async () => {
  const issue = await getIssueByIdentifier();

  const response = await app.request(`/api/issues/${issue.id}/timeline`);

  assert.equal(response.status, 200);

  const timeline = await response.json();
  const runEvent = timeline.find(
    (event: { type: string; details?: { contextSnapshot?: { promptSnapshot?: unknown } } }) =>
      event.type === "run",
  );

  assert.ok(runEvent, "expected at least one run event");
  assert.ok(
    runEvent.details?.contextSnapshot?.promptSnapshot,
    "run events should expose promptSnapshot under details.contextSnapshot.promptSnapshot",
  );
});

test("GET /api/runs/:id/prompt-snapshot returns the stored prompt snapshot", async () => {
  const runId = await getRunWithPromptSnapshot();

  const response = await app.request(`/api/runs/${runId}/prompt-snapshot`);

  assert.equal(response.status, 200);

  const snapshot = await response.json();
  assert.equal(snapshot.runId, runId);
  assert.ok(snapshot.promptSnapshot);
});

test("GET /api/runs/:id/events returns heartbeat run events", async () => {
  const runId = await getRunWithEvents();

  const response = await app.request(`/api/runs/${runId}/events`);

  assert.equal(response.status, 200);

  const events = await response.json();
  assert.ok(Array.isArray(events));
  assert.ok(events.length > 0);
  assert.equal(events[0].runId, runId);
});

test("build output keeps runtime-safe .js extension for db relations schema import", async () => {
  const build = spawnSync(process.execPath, ["./node_modules/typescript/bin/tsc"], {
    cwd: apiDir,
    encoding: "utf8",
  });

  assert.equal(build.status, 0, build.stderr || build.stdout);

  const builtRelations = await readFile(resolve(apiDir, "dist/db/relations.js"), "utf8");

  assert.match(builtRelations, /from "\.\/schema\.js";/);
});

test.after(async () => {
  await closeDb();
});
