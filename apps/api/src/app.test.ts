import test from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://baton:baton@localhost:5432/baton";

const { app } = await import("./app.js");
const { db, schema, closeDb } = await import("./db/index.js");

const missingCompanyId = "00000000-0000-0000-0000-000000000000";
const issueIdentifier = "DOB-147";

const getIssueByIdentifier = async (identifier = issueIdentifier) => {
  const [issue] = await db
    .select({
      id: schema.issues.id,
      companyId: schema.issues.companyId,
      projectId: schema.issues.projectId,
    })
    .from(schema.issues)
    .where(eq(schema.issues.identifier, identifier))
    .limit(1);

  assert.ok(issue, `${identifier} should exist in the shared Baton DB`);
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

const getAgentWithPromptSnapshot = async () => {
  const result = await db.execute(sql`
    select hr.agent_id as id
    from heartbeat_runs hr
    where hr.prompt_snapshot is not null
    order by hr.created_at desc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string }>;
  assert.ok(row?.id, "an agent with prompt_snapshot should exist");
  return row.id;
};

const getAgentInstructionEntry = async (agentId: string) => {
  const [instruction] = await db
    .select({
      path: schema.agentInstructions.path,
      content: schema.agentInstructions.content,
      source: schema.agentInstructions.source,
      updatedAt: schema.agentInstructions.updatedAt,
    })
    .from(schema.agentInstructions)
    .where(
      sql`${schema.agentInstructions.agentId} = ${agentId} and ${schema.agentInstructions.isEntryFile} = true`,
    )
    .limit(1);

  assert.ok(instruction, "a managed entry instruction should exist");
  return instruction;
};

const getBatonSkillSource = async () => {
  const [skill] = await db
    .select({
      skillName: schema.skillFiles.skillName,
      path: schema.skillFiles.path,
      content: schema.skillFiles.content,
      updatedAt: schema.skillFiles.updatedAt,
    })
    .from(schema.skillFiles)
    .where(
      sql`${schema.skillFiles.skillName} = 'baton' and ${schema.skillFiles.path} = 'SKILL.md'`,
    )
    .limit(1);

  assert.ok(skill, "the baton skill source should exist");
  return skill;
};

const getAgentWithoutRuns = async () => {
  const result = await db.execute(sql`
    select a.id
    from agents a
    left join heartbeat_runs hr on hr.agent_id = a.id
    group by a.id, a.created_at
    having count(hr.id) = 0
    order by a.created_at asc
    limit 1
  `);

  const [row] = result as unknown as Array<{ id: string }>;
  assert.ok(row?.id, "an agent without runs should exist");
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

test("GET /api/issues/:id/workflow-sessions returns normalized workflow sessions", async () => {
  const issue = await getIssueByIdentifier("DOB-184");

  const response = await app.request(`/api/issues/${issue.id}/workflow-sessions`);

  assert.equal(response.status, 200);

  const sessions = await response.json();
  assert.ok(Array.isArray(sessions));
  assert.ok(sessions.length >= 2);

  const [latest] = sessions;
  assert.equal(latest.issueId, issue.id);
  assert.equal(typeof latest.status, "string");
  assert.equal(typeof latest.kind, "string");
  assert.equal(typeof latest.epoch, "number");
  assert.equal(typeof latest.approvalId, "string");
  assert.equal(typeof latest.branch, "string");
  assert.equal(typeof latest.baseBranch, "string");
  assert.equal(typeof latest.createdAt, "string");
  assert.equal(typeof latest.updatedAt, "string");
  assert.equal(typeof latest.stale, "boolean");
  assert.equal(typeof latest.revision, "boolean");
  assert.equal(typeof latest.consumed, "boolean");

  const revisionSession = sessions.find((session: { revision: boolean; approvalStatus: string }) =>
    session.revision && session.approvalStatus === "rejected",
  );
  assert.ok(revisionSession, "expected at least one rejected revision session");

  const consumedSession = sessions.find((session: { consumed: boolean; commitSha: string | null }) =>
    session.consumed && typeof session.commitSha === "string",
  );
  assert.ok(consumedSession, "expected at least one consumed session with commit metadata");
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

test("GET /api/agents/:id/instructions returns instruction content and metadata", async () => {
  const agentId = await getAgentWithPromptSnapshot();
  const entryInstruction = await getAgentInstructionEntry(agentId);

  const response = await app.request(`/api/agents/${agentId}/instructions`);

  assert.equal(response.status, 200);

  const instructions = await response.json();
  assert.equal(instructions.agentId, agentId);
  assert.equal(instructions.source, entryInstruction.source);
  assert.equal(instructions.content, entryInstruction.content);
  assert.equal(typeof instructions.charCount, "number");
  assert.equal(instructions.charCount, instructions.content.length);
  assert.equal(instructions.entryFile, entryInstruction.path);
  assert.equal(instructions.updatedAt, entryInstruction.updatedAt);
});

test("GET /api/agents/:id/prompt-stack returns five ordered layers", async () => {
  const agentId = await getAgentWithPromptSnapshot();
  const batonSkill = await getBatonSkillSource();

  const response = await app.request(`/api/agents/${agentId}/prompt-stack`);

  assert.equal(response.status, 200);

  const promptStack = await response.json();
  assert.equal(promptStack.agentId, agentId);
  assert.equal(Array.isArray(promptStack.layers), true);
  assert.equal(promptStack.layers.length, 5);
  assert.deepEqual(
    promptStack.layers.map((layer: { key: string }) => layer.key),
    ["agentInstructions", "batonSkill", "projectConventions", "wakeContext", "promptTemplate"],
  );
  assert.ok(promptStack.layers.every((layer: { content: string; charCount: number; tokenEstimate: number }) =>
    typeof layer.content === "string" &&
    typeof layer.charCount === "number" &&
    layer.charCount === layer.content.length &&
    typeof layer.tokenEstimate === "number"
  ));

  const batonSkillLayer = promptStack.layers.find((layer: { key: string }) => layer.key === "batonSkill");
  assert.ok(batonSkillLayer);
  assert.equal(batonSkillLayer.content, batonSkill.content);
  assert.equal(batonSkillLayer.source, "database");
  assert.deepEqual(batonSkillLayer.metadata, {
    skillName: batonSkill.skillName,
    path: batonSkill.path,
    updatedAt: batonSkill.updatedAt,
  });
});

test("GET /api/agents/:id/runs returns run items in descending order", async () => {
  const agentId = await getAgentWithPromptSnapshot();

  const response = await app.request(`/api/agents/${agentId}/runs`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agentId);
  assert.ok(Array.isArray(payload.items));
  assert.ok(payload.items.length > 0);
  assert.equal(payload.items[0].agentId, agentId);
  assert.ok("usage" in payload.items[0]);
});

test("GET /api/agents/:id/costs returns aggregate totals and recent entries", async () => {
  const agentId = await getAgentWithPromptSnapshot();

  const response = await app.request(`/api/agents/${agentId}/costs`);

  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.agentId, agentId);
  assert.equal(typeof payload.summary.totalInputTokens, "number");
  assert.equal(typeof payload.summary.totalOutputTokens, "number");
  assert.equal(typeof payload.summary.totalCostCents, "number");
  assert.equal(Array.isArray(payload.byModel), true);
  assert.equal(Array.isArray(payload.recent), true);
});

test("agent detail APIs return empty-state payloads when no runs or costs exist", async () => {
  const agentId = await getAgentWithoutRuns();

  const [runsResponse, costsResponse, promptStackResponse] = await Promise.all([
    app.request(`/api/agents/${agentId}/runs`),
    app.request(`/api/agents/${agentId}/costs`),
    app.request(`/api/agents/${agentId}/prompt-stack`),
  ]);

  assert.equal(runsResponse.status, 200);
  assert.equal(costsResponse.status, 200);
  assert.equal(promptStackResponse.status, 200);

  const runsPayload = await runsResponse.json();
  const costsPayload = await costsResponse.json();
  const promptStackPayload = await promptStackResponse.json();

  assert.deepEqual(runsPayload.items, []);
  assert.equal(costsPayload.summary.totalInputTokens, 0);
  assert.equal(costsPayload.summary.totalOutputTokens, 0);
  assert.equal(costsPayload.summary.totalCostCents, 0);
  assert.deepEqual(costsPayload.recent, []);
  assert.equal(promptStackPayload.layers.length, 5);
});

test("agent detail APIs return 404 for an unknown agent id", async () => {
  for (const path of ["instructions", "prompt-stack", "runs", "costs"]) {
    const response = await app.request(`/api/agents/${missingCompanyId}/${path}`);

    assert.equal(response.status, 404);
  }
});

test.after(async () => {
  await closeDb();
});
