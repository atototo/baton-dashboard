import { pgTable, index, foreignKey, uuid, text, timestamp, jsonb, integer, bigint, boolean, bigserial, uniqueIndex, date, unique, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const agentApiKeys = pgTable("agent_api_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	agentId: uuid("agent_id").notNull(),
	companyId: uuid("company_id").notNull(),
	name: text().notNull(),
	keyHash: text("key_hash").notNull(),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_api_keys_company_agent_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.agentId.asc().nullsLast().op("uuid_ops")),
	index("agent_api_keys_key_hash_idx").using("btree", table.keyHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_api_keys_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_api_keys_company_id_companies_id_fk"
		}),
]);

export const approvals = pgTable("approvals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	type: text().notNull(),
	requestedByAgentId: uuid("requested_by_agent_id"),
	requestedByUserId: text("requested_by_user_id"),
	status: text().default('pending').notNull(),
	payload: jsonb().notNull(),
	decisionNote: text("decision_note"),
	decidedByUserId: text("decided_by_user_id"),
	decidedAt: timestamp("decided_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approvals_company_status_type_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.type.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "approvals_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.requestedByAgentId],
			foreignColumns: [agents.id],
			name: "approvals_requested_by_agent_id_agents_id_fk"
	}),
]);

export const agentInstructions = pgTable("agent_instructions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	path: text().notNull(),
	content: text().notNull(),
	isEntryFile: boolean("is_entry_file").default(false).notNull(),
	source: text().notNull(),
	contentHash: text("content_hash").notNull(),
	syncedFrom: text("synced_from"),
	syncedAt: timestamp("synced_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_instructions_agent_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops")),
	index("agent_instructions_company_agent_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.agentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_instructions_company_id_companies_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_instructions_agent_id_agents_id_fk"
		}).onDelete("cascade"),
]);

export const costEvents = pgTable("cost_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	issueId: uuid("issue_id"),
	projectId: uuid("project_id"),
	goalId: uuid("goal_id"),
	billingCode: text("billing_code"),
	provider: text().notNull(),
	model: text().notNull(),
	inputTokens: integer("input_tokens").default(0).notNull(),
	outputTokens: integer("output_tokens").default(0).notNull(),
	costCents: integer("cost_cents").notNull(),
	occurredAt: timestamp("occurred_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("cost_events_company_agent_occurred_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.agentId.asc().nullsLast().op("uuid_ops"), table.occurredAt.asc().nullsLast().op("uuid_ops")),
	index("cost_events_company_occurred_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.occurredAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "cost_events_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "cost_events_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.issueId],
			foreignColumns: [issues.id],
			name: "cost_events_issue_id_issues_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "cost_events_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goals.id],
			name: "cost_events_goal_id_goals_id_fk"
		}),
]);

export const goals = pgTable("goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	title: text().notNull(),
	description: text(),
	level: text().default('task').notNull(),
	status: text().default('planned').notNull(),
	parentId: uuid("parent_id"),
	ownerAgentId: uuid("owner_agent_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("goals_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "goals_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "goals_parent_id_goals_id_fk"
		}),
	foreignKey({
			columns: [table.ownerAgentId],
			foreignColumns: [agents.id],
			name: "goals_owner_agent_id_agents_id_fk"
		}),
]);

export const issueComments = pgTable("issue_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	issueId: uuid("issue_id").notNull(),
	authorAgentId: uuid("author_agent_id"),
	authorUserId: text("author_user_id"),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("issue_comments_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("issue_comments_issue_idx").using("btree", table.issueId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "issue_comments_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.issueId],
			foreignColumns: [issues.id],
			name: "issue_comments_issue_id_issues_id_fk"
		}),
	foreignKey({
			columns: [table.authorAgentId],
			foreignColumns: [agents.id],
			name: "issue_comments_author_agent_id_agents_id_fk"
		}),
]);

export const heartbeatRuns = pgTable("heartbeat_runs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	invocationSource: text("invocation_source").default('on_demand').notNull(),
	status: text().default('queued').notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	externalRunId: text("external_run_id"),
	contextSnapshot: jsonb("context_snapshot"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	triggerDetail: text("trigger_detail"),
	wakeupRequestId: uuid("wakeup_request_id"),
	exitCode: integer("exit_code"),
	signal: text(),
	usageJson: jsonb("usage_json"),
	resultJson: jsonb("result_json"),
	promptSnapshot: jsonb("prompt_snapshot"),
	sessionIdBefore: text("session_id_before"),
	sessionIdAfter: text("session_id_after"),
	logStore: text("log_store"),
	logRef: text("log_ref"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	logBytes: bigint("log_bytes", { mode: "number" }),
	logSha256: text("log_sha256"),
	logCompressed: boolean("log_compressed").default(false).notNull(),
	stdoutExcerpt: text("stdout_excerpt"),
	stderrExcerpt: text("stderr_excerpt"),
	errorCode: text("error_code"),
}, (table) => [
	index("heartbeat_runs_company_agent_started_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.agentId.asc().nullsLast().op("timestamptz_ops"), table.startedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "heartbeat_runs_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "heartbeat_runs_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.wakeupRequestId],
			foreignColumns: [agentWakeupRequests.id],
			name: "heartbeat_runs_wakeup_request_id_agent_wakeup_requests_id_fk"
		}),
]);

export const agentRuntimeState = pgTable("agent_runtime_state", {
	agentId: uuid("agent_id").primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	adapterType: text("adapter_type").notNull(),
	sessionId: text("session_id"),
	stateJson: jsonb("state_json").default({}).notNull(),
	lastRunId: uuid("last_run_id"),
	lastRunStatus: text("last_run_status"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalInputTokens: bigint("total_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalOutputTokens: bigint("total_output_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCachedInputTokens: bigint("total_cached_input_tokens", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalCostCents: bigint("total_cost_cents", { mode: "number" }).default(0).notNull(),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_runtime_state_company_agent_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.agentId.asc().nullsLast().op("uuid_ops")),
	index("agent_runtime_state_company_updated_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_runtime_state_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_runtime_state_company_id_companies_id_fk"
		}),
]);

export const agentWakeupRequests = pgTable("agent_wakeup_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	source: text().notNull(),
	triggerDetail: text("trigger_detail"),
	reason: text(),
	payload: jsonb(),
	status: text().default('queued').notNull(),
	coalescedCount: integer("coalesced_count").default(0).notNull(),
	requestedByActorType: text("requested_by_actor_type"),
	requestedByActorId: text("requested_by_actor_id"),
	idempotencyKey: text("idempotency_key"),
	runId: uuid("run_id"),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_wakeup_requests_agent_requested_idx").using("btree", table.agentId.asc().nullsLast().op("uuid_ops"), table.requestedAt.asc().nullsLast().op("uuid_ops")),
	index("agent_wakeup_requests_company_agent_status_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.agentId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("agent_wakeup_requests_company_requested_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.requestedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_wakeup_requests_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_wakeup_requests_agent_id_agents_id_fk"
		}),
]);

export const heartbeatRunEvents = pgTable("heartbeat_run_events", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	runId: uuid("run_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	seq: integer().notNull(),
	eventType: text("event_type").notNull(),
	stream: text(),
	level: text(),
	color: text(),
	message: text(),
	payload: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("heartbeat_run_events_company_created_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("heartbeat_run_events_company_run_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.runId.asc().nullsLast().op("uuid_ops")),
	index("heartbeat_run_events_run_seq_idx").using("btree", table.runId.asc().nullsLast().op("uuid_ops"), table.seq.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "heartbeat_run_events_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [heartbeatRuns.id],
			name: "heartbeat_run_events_run_id_heartbeat_runs_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "heartbeat_run_events_agent_id_agents_id_fk"
		}),
]);

export const activityLog = pgTable("activity_log", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	actorType: text("actor_type").default('system').notNull(),
	actorId: text("actor_id").notNull(),
	action: text().notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	agentId: uuid("agent_id"),
	details: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	runId: uuid("run_id"),
}, (table) => [
	index("activity_log_company_created_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("activity_log_entity_type_id_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops"), table.entityId.asc().nullsLast().op("text_ops")),
	index("activity_log_run_id_idx").using("btree", table.runId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "activity_log_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "activity_log_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.runId],
			foreignColumns: [heartbeatRuns.id],
			name: "activity_log_run_id_heartbeat_runs_id_fk"
		}),
]);

export const approvalComments = pgTable("approval_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	approvalId: uuid("approval_id").notNull(),
	authorAgentId: uuid("author_agent_id"),
	authorUserId: text("author_user_id"),
	body: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("approval_comments_approval_created_idx").using("btree", table.approvalId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("approval_comments_approval_idx").using("btree", table.approvalId.asc().nullsLast().op("uuid_ops")),
	index("approval_comments_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "approval_comments_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.approvalId],
			foreignColumns: [approvals.id],
			name: "approval_comments_approval_id_approvals_id_fk"
		}),
	foreignKey({
			columns: [table.authorAgentId],
			foreignColumns: [agents.id],
			name: "approval_comments_author_agent_id_agents_id_fk"
		}),
]);

export const agentConfigRevisions = pgTable("agent_config_revisions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	createdByAgentId: uuid("created_by_agent_id"),
	createdByUserId: text("created_by_user_id"),
	source: text().default('patch').notNull(),
	rolledBackFromRevisionId: uuid("rolled_back_from_revision_id"),
	changedKeys: jsonb("changed_keys").default([]).notNull(),
	beforeConfig: jsonb("before_config").notNull(),
	afterConfig: jsonb("after_config").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("agent_config_revisions_agent_created_idx").using("btree", table.agentId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("agent_config_revisions_company_agent_created_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.agentId.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_config_revisions_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_config_revisions_agent_id_agents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByAgentId],
			foreignColumns: [agents.id],
			name: "agent_config_revisions_created_by_agent_id_agents_id_fk"
		}).onDelete("set null"),
]);

export const agentTaskSessions = pgTable("agent_task_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	agentId: uuid("agent_id").notNull(),
	adapterType: text("adapter_type").notNull(),
	taskKey: text("task_key").notNull(),
	sessionParamsJson: jsonb("session_params_json"),
	sessionDisplayId: text("session_display_id"),
	lastRunId: uuid("last_run_id"),
	lastError: text("last_error"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("agent_task_sessions_company_agent_adapter_task_uniq").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.agentId.asc().nullsLast().op("uuid_ops"), table.adapterType.asc().nullsLast().op("text_ops"), table.taskKey.asc().nullsLast().op("text_ops")),
	index("agent_task_sessions_company_agent_updated_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.agentId.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("uuid_ops")),
	index("agent_task_sessions_company_task_updated_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.taskKey.asc().nullsLast().op("timestamptz_ops"), table.updatedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agent_task_sessions_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [agents.id],
			name: "agent_task_sessions_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.lastRunId],
			foreignColumns: [heartbeatRuns.id],
			name: "agent_task_sessions_last_run_id_heartbeat_runs_id_fk"
		}),
]);

export const companySecrets = pgTable("company_secrets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	name: text().notNull(),
	provider: text().default('local_encrypted').notNull(),
	externalRef: text("external_ref"),
	latestVersion: integer("latest_version").default(1).notNull(),
	description: text(),
	createdByAgentId: uuid("created_by_agent_id"),
	createdByUserId: text("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("company_secrets_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("company_secrets_company_name_uq").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.name.asc().nullsLast().op("text_ops")),
	index("company_secrets_company_provider_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_secrets_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.createdByAgentId],
			foreignColumns: [agents.id],
			name: "company_secrets_created_by_agent_id_agents_id_fk"
		}).onDelete("set null"),
]);

export const companySecretVersions = pgTable("company_secret_versions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	secretId: uuid("secret_id").notNull(),
	version: integer().notNull(),
	material: jsonb().notNull(),
	valueSha256: text("value_sha256").notNull(),
	createdByAgentId: uuid("created_by_agent_id"),
	createdByUserId: text("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("company_secret_versions_secret_idx").using("btree", table.secretId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("company_secret_versions_secret_version_uq").using("btree", table.secretId.asc().nullsLast().op("int4_ops"), table.version.asc().nullsLast().op("uuid_ops")),
	index("company_secret_versions_value_sha256_idx").using("btree", table.valueSha256.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.secretId],
			foreignColumns: [companySecrets.id],
			name: "company_secret_versions_secret_id_company_secrets_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdByAgentId],
			foreignColumns: [agents.id],
			name: "company_secret_versions_created_by_agent_id_agents_id_fk"
		}).onDelete("set null"),
]);

export const assets = pgTable("assets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	provider: text().notNull(),
	objectKey: text("object_key").notNull(),
	contentType: text("content_type").notNull(),
	byteSize: integer("byte_size").notNull(),
	sha256: text().notNull(),
	originalFilename: text("original_filename"),
	createdByAgentId: uuid("created_by_agent_id"),
	createdByUserId: text("created_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("assets_company_created_idx").using("btree", table.companyId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("assets_company_object_key_uq").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.objectKey.asc().nullsLast().op("uuid_ops")),
	index("assets_company_provider_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.provider.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "assets_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.createdByAgentId],
			foreignColumns: [agents.id],
			name: "assets_created_by_agent_id_agents_id_fk"
		}),
]);

export const issueAttachments = pgTable("issue_attachments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	issueId: uuid("issue_id").notNull(),
	assetId: uuid("asset_id").notNull(),
	issueCommentId: uuid("issue_comment_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("issue_attachments_asset_uq").using("btree", table.assetId.asc().nullsLast().op("uuid_ops")),
	index("issue_attachments_company_issue_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.issueId.asc().nullsLast().op("uuid_ops")),
	index("issue_attachments_issue_comment_idx").using("btree", table.issueCommentId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "issue_attachments_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.issueId],
			foreignColumns: [issues.id],
			name: "issue_attachments_issue_id_issues_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [assets.id],
			name: "issue_attachments_asset_id_assets_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.issueCommentId],
			foreignColumns: [issueComments.id],
			name: "issue_attachments_issue_comment_id_issue_comments_id_fk"
		}).onDelete("set null"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const instanceUserRoles = pgTable("instance_user_roles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	role: text().default('instance_admin').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("instance_user_roles_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	uniqueIndex("instance_user_roles_user_role_unique_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.role.asc().nullsLast().op("text_ops")),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
});

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const companyMemberships = pgTable("company_memberships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	principalType: text("principal_type").notNull(),
	principalId: text("principal_id").notNull(),
	status: text().default('active').notNull(),
	membershipRole: text("membership_role"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("company_memberships_company_principal_unique_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.principalType.asc().nullsLast().op("uuid_ops"), table.principalId.asc().nullsLast().op("text_ops")),
	index("company_memberships_company_status_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("company_memberships_principal_status_idx").using("btree", table.principalType.asc().nullsLast().op("text_ops"), table.principalId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "company_memberships_company_id_companies_id_fk"
		}),
]);

export const invites = pgTable("invites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id"),
	inviteType: text("invite_type").default('company_join').notNull(),
	tokenHash: text("token_hash").notNull(),
	allowedJoinTypes: text("allowed_join_types").default('both').notNull(),
	defaultsPayload: jsonb("defaults_payload"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	invitedByUserId: text("invited_by_user_id"),
	revokedAt: timestamp("revoked_at", { withTimezone: true, mode: 'string' }),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invites_company_invite_state_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.inviteType.asc().nullsLast().op("uuid_ops"), table.revokedAt.asc().nullsLast().op("uuid_ops"), table.expiresAt.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("invites_token_hash_unique_idx").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "invites_company_id_companies_id_fk"
		}),
]);

export const principalPermissionGrants = pgTable("principal_permission_grants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	principalType: text("principal_type").notNull(),
	principalId: text("principal_id").notNull(),
	permissionKey: text("permission_key").notNull(),
	scope: jsonb(),
	grantedByUserId: text("granted_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("principal_permission_grants_company_permission_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.permissionKey.asc().nullsLast().op("text_ops")),
	uniqueIndex("principal_permission_grants_unique_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.principalType.asc().nullsLast().op("text_ops"), table.principalId.asc().nullsLast().op("uuid_ops"), table.permissionKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "principal_permission_grants_company_id_companies_id_fk"
		}),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	goalId: uuid("goal_id"),
	name: text().notNull(),
	description: text(),
	status: text().default('backlog').notNull(),
	leadAgentId: uuid("lead_agent_id"),
	targetDate: date("target_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	color: text(),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("projects_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "projects_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goals.id],
			name: "projects_goal_id_goals_id_fk"
		}),
	foreignKey({
			columns: [table.leadAgentId],
			foreignColumns: [agents.id],
			name: "projects_lead_agent_id_agents_id_fk"
		}),
]);

export const agents = pgTable("agents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	name: text().notNull(),
	role: text().default('general').notNull(),
	title: text(),
	status: text().default('idle').notNull(),
	reportsTo: uuid("reports_to"),
	capabilities: text(),
	adapterType: text("adapter_type").default('process').notNull(),
	adapterConfig: jsonb("adapter_config").default({}).notNull(),
	budgetMonthlyCents: integer("budget_monthly_cents").default(0).notNull(),
	spentMonthlyCents: integer("spent_monthly_cents").default(0).notNull(),
	lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true, mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	runtimeConfig: jsonb("runtime_config").default({}).notNull(),
	permissions: jsonb().default({}).notNull(),
	icon: text(),
}, (table) => [
	index("agents_company_reports_to_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.reportsTo.asc().nullsLast().op("uuid_ops")),
	index("agents_company_status_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "agents_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.reportsTo],
			foreignColumns: [table.id],
			name: "agents_reports_to_agents_id_fk"
		}),
]);

export const labels = pgTable("labels", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	name: text().notNull(),
	color: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("labels_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("labels_company_name_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "labels_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const projectWorkspaces = pgTable("project_workspaces", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	projectId: uuid("project_id").notNull(),
	name: text().notNull(),
	cwd: text(),
	repoUrl: text("repo_url"),
	repoRef: text("repo_ref"),
	metadata: jsonb(),
	isPrimary: boolean("is_primary").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("project_workspaces_company_project_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.projectId.asc().nullsLast().op("uuid_ops")),
	index("project_workspaces_project_primary_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops"), table.isPrimary.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "project_workspaces_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_workspaces_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const joinRequests = pgTable("join_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	inviteId: uuid("invite_id").notNull(),
	companyId: uuid("company_id").notNull(),
	requestType: text("request_type").notNull(),
	status: text().default('pending_approval').notNull(),
	requestIp: text("request_ip").notNull(),
	requestingUserId: text("requesting_user_id"),
	requestEmailSnapshot: text("request_email_snapshot"),
	agentName: text("agent_name"),
	adapterType: text("adapter_type"),
	capabilities: text(),
	agentDefaultsPayload: jsonb("agent_defaults_payload"),
	createdAgentId: uuid("created_agent_id"),
	approvedByUserId: text("approved_by_user_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectedByUserId: text("rejected_by_user_id"),
	rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	claimSecretHash: text("claim_secret_hash"),
	claimSecretExpiresAt: timestamp("claim_secret_expires_at", { withTimezone: true, mode: 'string' }),
	claimSecretConsumedAt: timestamp("claim_secret_consumed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("join_requests_company_status_type_created_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.requestType.asc().nullsLast().op("uuid_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	uniqueIndex("join_requests_invite_unique_idx").using("btree", table.inviteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.inviteId],
			foreignColumns: [invites.id],
			name: "join_requests_invite_id_invites_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "join_requests_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.createdAgentId],
			foreignColumns: [agents.id],
			name: "join_requests_created_agent_id_agents_id_fk"
		}),
]);

export const companies = pgTable("companies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	status: text().default('active').notNull(),
	budgetMonthlyCents: integer("budget_monthly_cents").default(0).notNull(),
	spentMonthlyCents: integer("spent_monthly_cents").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	issuePrefix: text("issue_prefix").default('PAP').notNull(),
	issueCounter: integer("issue_counter").default(0).notNull(),
	requireBoardApprovalForNewAgents: boolean("require_board_approval_for_new_agents").default(true).notNull(),
	brandColor: text("brand_color"),
	locale: text().default('en').notNull(),
}, (table) => [
	uniqueIndex("companies_issue_prefix_idx").using("btree", table.issuePrefix.asc().nullsLast().op("text_ops")),
]);

export const executionWorkspaces = pgTable("execution_workspaces", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	ownerIssueId: uuid("owner_issue_id"),
	projectId: uuid("project_id"),
	projectWorkspaceId: uuid("project_workspace_id"),
	sourceRepoCwd: text("source_repo_cwd").notNull(),
	executionCwd: text("execution_cwd").notNull(),
	ticketKey: text("ticket_key").notNull(),
	branch: text().notNull(),
	baseBranch: text("base_branch").notNull(),
	status: text().default('ready').notNull(),
	provisionedAt: timestamp("provisioned_at", { withTimezone: true, mode: 'string' }),
	cleanedAt: timestamp("cleaned_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("execution_workspaces_company_owner_issue_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.ownerIssueId.asc().nullsLast().op("uuid_ops")),
	index("execution_workspaces_company_status_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("execution_workspaces_company_workspace_ticket_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.projectWorkspaceId.asc().nullsLast().op("uuid_ops"), table.ticketKey.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "execution_workspaces_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "execution_workspaces_project_id_projects_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.projectWorkspaceId],
			foreignColumns: [projectWorkspaces.id],
			name: "execution_workspaces_project_workspace_id_project_workspaces_id"
		}).onDelete("set null"),
]);

export const issues = pgTable("issues", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	projectId: uuid("project_id"),
	goalId: uuid("goal_id"),
	parentId: uuid("parent_id"),
	title: text().notNull(),
	description: text(),
	status: text().default('backlog').notNull(),
	priority: text().default('medium').notNull(),
	assigneeAgentId: uuid("assignee_agent_id"),
	createdByAgentId: uuid("created_by_agent_id"),
	createdByUserId: text("created_by_user_id"),
	requestDepth: integer("request_depth").default(0).notNull(),
	billingCode: text("billing_code"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	issueNumber: integer("issue_number"),
	identifier: text(),
	hiddenAt: timestamp("hidden_at", { withTimezone: true, mode: 'string' }),
	checkoutRunId: uuid("checkout_run_id"),
	executionRunId: uuid("execution_run_id"),
	executionAgentNameKey: text("execution_agent_name_key"),
	executionLockedAt: timestamp("execution_locked_at", { withTimezone: true, mode: 'string' }),
	assigneeUserId: text("assignee_user_id"),
	assigneeAdapterOverrides: jsonb("assignee_adapter_overrides"),
	executionWorkspaceId: uuid("execution_workspace_id"),
	delegation: jsonb(),
}, (table) => [
	index("issues_company_assignee_status_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.assigneeAgentId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	index("issues_company_assignee_user_status_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.assigneeUserId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("text_ops")),
	index("issues_company_parent_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.parentId.asc().nullsLast().op("uuid_ops")),
	index("issues_company_project_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.projectId.asc().nullsLast().op("uuid_ops")),
	index("issues_company_status_idx").using("btree", table.companyId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("issues_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "issues_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "issues_project_id_projects_id_fk"
		}),
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goals.id],
			name: "issues_goal_id_goals_id_fk"
		}),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "issues_parent_id_issues_id_fk"
		}),
	foreignKey({
			columns: [table.assigneeAgentId],
			foreignColumns: [agents.id],
			name: "issues_assignee_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.createdByAgentId],
			foreignColumns: [agents.id],
			name: "issues_created_by_agent_id_agents_id_fk"
		}),
	foreignKey({
			columns: [table.checkoutRunId],
			foreignColumns: [heartbeatRuns.id],
			name: "issues_checkout_run_id_heartbeat_runs_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.executionRunId],
			foreignColumns: [heartbeatRuns.id],
			name: "issues_execution_run_id_heartbeat_runs_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.executionWorkspaceId],
			foreignColumns: [executionWorkspaces.id],
			name: "issues_execution_workspace_id_execution_workspaces_id_fk"
		}).onDelete("set null"),
]);

export const projectConventions = pgTable("project_conventions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	projectId: uuid("project_id").notNull(),
	conventionsMd: text("conventions_md").default('').notNull(),
	backstory: text().default('').notNull(),
	compactContext: text("compact_context"),
	extraReferences: jsonb("extra_references").default([]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("project_conventions_project_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "project_conventions_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_conventions_project_id_projects_id_fk"
		}).onDelete("cascade"),
	unique("project_conventions_company_project_uniq").on(table.companyId, table.projectId),
]);

export const skillFiles = pgTable("skill_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	companyId: uuid("company_id").notNull(),
	skillName: text("skill_name").notNull(),
	path: text().notNull(),
	content: text().notNull(),
	contentHash: text("content_hash").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("skill_files_company_skill_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops"), table.skillName.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "skill_files_company_id_companies_id_fk"
		}).onDelete("cascade"),
]);

export const issueLabels = pgTable("issue_labels", {
	issueId: uuid("issue_id").notNull(),
	labelId: uuid("label_id").notNull(),
	companyId: uuid("company_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("issue_labels_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("issue_labels_issue_idx").using("btree", table.issueId.asc().nullsLast().op("uuid_ops")),
	index("issue_labels_label_idx").using("btree", table.labelId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.issueId],
			foreignColumns: [issues.id],
			name: "issue_labels_issue_id_issues_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.labelId],
			foreignColumns: [labels.id],
			name: "issue_labels_label_id_labels_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "issue_labels_company_id_companies_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.issueId, table.labelId], name: "issue_labels_pk"}),
]);

export const projectGoals = pgTable("project_goals", {
	projectId: uuid("project_id").notNull(),
	goalId: uuid("goal_id").notNull(),
	companyId: uuid("company_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("project_goals_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("project_goals_goal_idx").using("btree", table.goalId.asc().nullsLast().op("uuid_ops")),
	index("project_goals_project_idx").using("btree", table.projectId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "project_goals_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [goals.id],
			name: "project_goals_goal_id_goals_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "project_goals_company_id_companies_id_fk"
		}),
	primaryKey({ columns: [table.projectId, table.goalId], name: "project_goals_project_id_goal_id_pk"}),
]);

export const issueApprovals = pgTable("issue_approvals", {
	companyId: uuid("company_id").notNull(),
	issueId: uuid("issue_id").notNull(),
	approvalId: uuid("approval_id").notNull(),
	linkedByAgentId: uuid("linked_by_agent_id"),
	linkedByUserId: text("linked_by_user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("issue_approvals_approval_idx").using("btree", table.approvalId.asc().nullsLast().op("uuid_ops")),
	index("issue_approvals_company_idx").using("btree", table.companyId.asc().nullsLast().op("uuid_ops")),
	index("issue_approvals_issue_idx").using("btree", table.issueId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [companies.id],
			name: "issue_approvals_company_id_companies_id_fk"
		}),
	foreignKey({
			columns: [table.issueId],
			foreignColumns: [issues.id],
			name: "issue_approvals_issue_id_issues_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.approvalId],
			foreignColumns: [approvals.id],
			name: "issue_approvals_approval_id_approvals_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.linkedByAgentId],
			foreignColumns: [agents.id],
			name: "issue_approvals_linked_by_agent_id_agents_id_fk"
		}).onDelete("set null"),
	primaryKey({ columns: [table.issueId, table.approvalId], name: "issue_approvals_pk"}),
]);
