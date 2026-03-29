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
      projectId: schema.issues.projectId,
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

const getAgentWithPromptData = async () => {
  const result = await db.execute(sql`
    select
      a.id,
      a.company_id as "companyId",
      a.name
    from agents a
    join agent_instructions ai on ai.agent_id = a.id
    join heartbeat_runs hr on hr.agent_id = a.id
    where hr.prompt_snapshot is not null
    order by hr.created_at desc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string; companyId: string; name: string }>;
  assert.ok(row?.id, "an agent with instructions and prompt data should exist");
  return row;
};

const getAgentWithCosts = async () => {
  const result = await db.execute(sql`
    select
      a.id,
      a.company_id as "companyId"
    from agents a
    join cost_events ce on ce.agent_id = a.id
    group by a.id, a.company_id
    order by max(ce.occurred_at) desc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string; companyId: string }>;
  assert.ok(row?.id, "an agent with cost events should exist");
  return row;
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

test("GET /api/issues/stats/summary filters by companyId and projectId", async () => {
  const issue = await getIssueByIdentifier();

  const expected = await db
    .select({
      status: schema.issues.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.issues)
    .where(
      sql`${schema.issues.hiddenAt} is null
        and ${schema.issues.companyId} = ${issue.companyId}
        and ${schema.issues.projectId} = ${issue.projectId}`,
    )
    .groupBy(schema.issues.status);

  const response = await app.request(
    `/api/issues/stats/summary?companyId=${issue.companyId}&projectId=${issue.projectId}`,
  );

  assert.equal(response.status, 200);

  const summary = await response.json();
  assert.deepEqual(
    summary.sort((left: { status: string }, right: { status: string }) => left.status.localeCompare(right.status)),
    expected.sort((left, right) => left.status.localeCompare(right.status)),
  );
});

test("GET /api/issues filters the list by projectId", async () => {
  const issue = await getIssueByIdentifier();

  const response = await app.request(`/api/issues?projectId=${issue.projectId}`);

  assert.equal(response.status, 200);

  const issues = await response.json();
  assert.ok(Array.isArray(issues));
  assert.ok(issues.length > 0);
  assert.ok(
    issues.every((row: { projectId: string | null }) => row.projectId === issue.projectId),
    "every returned issue should belong to the requested project",
  );
});

test("PATCH /api/issues/:id updates the issue status", async () => {
  const issue = await getIssueByIdentifier();
  const [before] = await db
    .select({
      status: schema.issues.status,
    })
    .from(schema.issues)
    .where(eq(schema.issues.id, issue.id))
    .limit(1);

  assert.ok(before, "issue should exist before patching");

  const nextStatus = before.status === "in_progress" ? "todo" : "in_progress";

  const response = await app.request(`/api/issues/${issue.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      status: nextStatus,
    }),
  });

  assert.equal(response.status, 200);

  const updated = await response.json();
  assert.equal(updated.id, issue.id);
  assert.equal(updated.status, nextStatus);

  const [stored] = await db
    .select({
      status: schema.issues.status,
    })
    .from(schema.issues)
    .where(eq(schema.issues.id, issue.id))
    .limit(1);

  assert.equal(stored?.status, nextStatus);

  await db
    .update(schema.issues)
    .set({
      status: before.status,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.issues.id, issue.id));
});

test("GET /api/projects/:id/stats returns total and status counts for the project", async () => {
  const issue = await getIssueByIdentifier();

  const expected = await db
    .select({
      status: schema.issues.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.issues)
    .where(
      sql`${schema.issues.hiddenAt} is null
        and ${schema.issues.projectId} = ${issue.projectId}`,
    )
    .groupBy(schema.issues.status);

  const response = await app.request(`/api/projects/${issue.projectId}/stats`);

  assert.equal(response.status, 200);

  const stats = await response.json();
  assert.equal(stats.total, expected.reduce((sum, row) => sum + row.count, 0));
  assert.deepEqual(
    Object.entries(stats.byStatus).sort(([left], [right]) => left.localeCompare(right)),
    expected
      .map((row) => [row.status, row.count] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
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
  const runEvent = timeline.find((event: { type: string; details?: { contextSnapshot?: { promptSnapshot?: unknown } } }) =>
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

test("GET /api/agents/:id/instructions returns the managed instruction bundle", async () => {
  const agent = await getAgentWithPromptData();

  const response = await app.request(`/api/agents/${agent.id}/instructions`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agent.id);
  assert.equal(typeof payload.entryFilePath, "string");
  assert.ok(Array.isArray(payload.files));
  assert.ok(payload.files.length > 0);
  assert.ok(payload.files.some((file: { isEntryFile: boolean }) => file.isEntryFile));
  assert.equal(typeof payload.bundleText, "string");
  assert.ok(payload.bundleText.length > 0);
});

test("GET /api/agents/:id/prompt-stack returns five ordered layers", async () => {
  const agent = await getAgentWithPromptData();

  const response = await app.request(`/api/agents/${agent.id}/prompt-stack`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agent.id);
  assert.ok(Array.isArray(payload.layers));
  assert.equal(payload.layers.length, 5);
  assert.deepEqual(
    payload.layers.map((layer: { key: string }) => layer.key),
    ["agent_instructions", "baton_skill", "project_conventions", "wake_context", "prompt_template"],
  );
  assert.ok(payload.layers.every((layer: { order: number; estimatedTokens: number }) => Number.isInteger(layer.order) && layer.estimatedTokens >= 0));
});

test("GET /api/agents/:id/runs returns latest runs with excerpts", async () => {
  const agent = await getAgentWithPromptData();

  const response = await app.request(`/api/agents/${agent.id}/runs`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agent.id);
  assert.ok(Array.isArray(payload.runs));
  assert.ok(payload.runs.length > 0);
  assert.ok("excerpt" in payload.runs[0]);
  assert.ok("invocationSource" in payload.runs[0]);
  assert.ok("triggerDetail" in payload.runs[0]);
});

test("GET /api/agents/:id/costs returns aggregated token and cost totals", async () => {
  const agent = await getAgentWithCosts();

  const response = await app.request(`/api/agents/${agent.id}/costs`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agent.id);
  assert.equal(typeof payload.totals.inputTokens, "number");
  assert.equal(typeof payload.totals.outputTokens, "number");
  assert.equal(typeof payload.totals.costCents, "number");
  assert.equal(typeof payload.totals.eventCount, "number");
  assert.ok("window" in payload);
});

test.after(async () => {
  await closeDb();
});
