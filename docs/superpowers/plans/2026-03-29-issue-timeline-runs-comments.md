# Issue Timeline Runs Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add issue timeline, run prompt snapshot, run events, and issue comment read/write APIs in `apps/api`.

**Architecture:** Keep issue-scoped endpoints in `src/routes/issues.ts` and add a dedicated `src/routes/runs.ts` for run lookups. Reuse the shared Drizzle schema against the Baton PostgreSQL database, enriching responses with joined agent and user metadata where available.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, postgres.js, node:test

---

### Task 1: Lock API expectations with tests

**Files:**
- Modify: `apps/api/src/app.test.ts`

- [ ] Add failing API tests for issue timeline, issue comments GET/POST, run prompt snapshot, and run events.
- [ ] Run the targeted API test file and confirm the new cases fail for missing routes/fields.

### Task 2: Expose issue timeline and comments

**Files:**
- Modify: `apps/api/src/routes/issues.ts`

- [ ] Add `GET /api/issues/:id/timeline` that merges activity logs, linked approvals, comments, and related runs for the issue.
- [ ] Add `GET /api/issues/:id/comments` with author enrichment.
- [ ] Add `POST /api/issues/:id/comments` with minimal validation and inserted-row response.

### Task 3: Expose run detail endpoints

**Files:**
- Create: `apps/api/src/routes/runs.ts`
- Modify: `apps/api/src/app.ts`

- [ ] Add `GET /api/runs/:id/prompt-snapshot`.
- [ ] Add `GET /api/runs/:id/events`.
- [ ] Register the new route tree under `/api/runs`.

### Task 4: Align schema and verify

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] Add missing `heartbeat_runs.prompt_snapshot` mapping to Drizzle.
- [ ] Run the API test file until green.
- [ ] Run `pnpm --filter api build`.
