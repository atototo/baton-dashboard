import test from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://baton:baton@localhost:5432/baton";

const { app } = await import("./app.js");
const { db, schema, closeDb } = await import("./db/index.js");

const missingCompanyId = "00000000-0000-0000-0000-000000000000";
const issueIdentifier = "DOB-147";

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

test.after(async () => {
  await closeDb();
});
