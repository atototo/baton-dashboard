import { relations } from "drizzle-orm/relations";
import { agents, agentApiKeys, companies, approvals, costEvents, issues, projects, goals, issueComments, heartbeatRuns, agentWakeupRequests, agentRuntimeState, heartbeatRunEvents, activityLog, approvalComments, agentConfigRevisions, agentTaskSessions, companySecrets, companySecretVersions, assets, issueAttachments, user, account, session, companyMemberships, invites, principalPermissionGrants, labels, projectWorkspaces, joinRequests, executionWorkspaces, projectConventions, issueLabels, projectGoals, issueApprovals } from "./schema.js";

export const agentApiKeysRelations = relations(agentApiKeys, ({one}) => ({
	agent: one(agents, {
		fields: [agentApiKeys.agentId],
		references: [agents.id]
	}),
	company: one(companies, {
		fields: [agentApiKeys.companyId],
		references: [companies.id]
	}),
}));

export const agentsRelations = relations(agents, ({one, many}) => ({
	agentApiKeys: many(agentApiKeys),
	approvals: many(approvals),
	costEvents: many(costEvents),
	goals: many(goals),
	issueComments: many(issueComments),
	heartbeatRuns: many(heartbeatRuns),
	agentRuntimeStates: many(agentRuntimeState),
	agentWakeupRequests: many(agentWakeupRequests),
	heartbeatRunEvents: many(heartbeatRunEvents),
	activityLogs: many(activityLog),
	approvalComments: many(approvalComments),
	agentConfigRevisions_agentId: many(agentConfigRevisions, {
		relationName: "agentConfigRevisions_agentId_agents_id"
	}),
	agentConfigRevisions_createdByAgentId: many(agentConfigRevisions, {
		relationName: "agentConfigRevisions_createdByAgentId_agents_id"
	}),
	agentTaskSessions: many(agentTaskSessions),
	companySecrets: many(companySecrets),
	companySecretVersions: many(companySecretVersions),
	assets: many(assets),
	projects: many(projects),
	company: one(companies, {
		fields: [agents.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [agents.reportsTo],
		references: [agents.id],
		relationName: "agents_reportsTo_agents_id"
	}),
	agents: many(agents, {
		relationName: "agents_reportsTo_agents_id"
	}),
	joinRequests: many(joinRequests),
	issues_assigneeAgentId: many(issues, {
		relationName: "issues_assigneeAgentId_agents_id"
	}),
	issues_createdByAgentId: many(issues, {
		relationName: "issues_createdByAgentId_agents_id"
	}),
	issueApprovals: many(issueApprovals),
}));

export const companiesRelations = relations(companies, ({many}) => ({
	agentApiKeys: many(agentApiKeys),
	approvals: many(approvals),
	costEvents: many(costEvents),
	goals: many(goals),
	issueComments: many(issueComments),
	heartbeatRuns: many(heartbeatRuns),
	agentRuntimeStates: many(agentRuntimeState),
	agentWakeupRequests: many(agentWakeupRequests),
	heartbeatRunEvents: many(heartbeatRunEvents),
	activityLogs: many(activityLog),
	approvalComments: many(approvalComments),
	agentConfigRevisions: many(agentConfigRevisions),
	agentTaskSessions: many(agentTaskSessions),
	companySecrets: many(companySecrets),
	assets: many(assets),
	issueAttachments: many(issueAttachments),
	companyMemberships: many(companyMemberships),
	invites: many(invites),
	principalPermissionGrants: many(principalPermissionGrants),
	projects: many(projects),
	agents: many(agents),
	labels: many(labels),
	projectWorkspaces: many(projectWorkspaces),
	joinRequests: many(joinRequests),
	executionWorkspaces: many(executionWorkspaces),
	issues: many(issues),
	projectConventions: many(projectConventions),
	issueLabels: many(issueLabels),
	projectGoals: many(projectGoals),
	issueApprovals: many(issueApprovals),
}));

export const approvalsRelations = relations(approvals, ({one, many}) => ({
	company: one(companies, {
		fields: [approvals.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [approvals.requestedByAgentId],
		references: [agents.id]
	}),
	approvalComments: many(approvalComments),
	issueApprovals: many(issueApprovals),
}));

export const costEventsRelations = relations(costEvents, ({one}) => ({
	company: one(companies, {
		fields: [costEvents.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [costEvents.agentId],
		references: [agents.id]
	}),
	issue: one(issues, {
		fields: [costEvents.issueId],
		references: [issues.id]
	}),
	project: one(projects, {
		fields: [costEvents.projectId],
		references: [projects.id]
	}),
	goal: one(goals, {
		fields: [costEvents.goalId],
		references: [goals.id]
	}),
}));

export const issuesRelations = relations(issues, ({one, many}) => ({
	costEvents: many(costEvents),
	issueComments: many(issueComments),
	issueAttachments: many(issueAttachments),
	company: one(companies, {
		fields: [issues.companyId],
		references: [companies.id]
	}),
	project: one(projects, {
		fields: [issues.projectId],
		references: [projects.id]
	}),
	goal: one(goals, {
		fields: [issues.goalId],
		references: [goals.id]
	}),
	issue: one(issues, {
		fields: [issues.parentId],
		references: [issues.id],
		relationName: "issues_parentId_issues_id"
	}),
	issues: many(issues, {
		relationName: "issues_parentId_issues_id"
	}),
	agent_assigneeAgentId: one(agents, {
		fields: [issues.assigneeAgentId],
		references: [agents.id],
		relationName: "issues_assigneeAgentId_agents_id"
	}),
	agent_createdByAgentId: one(agents, {
		fields: [issues.createdByAgentId],
		references: [agents.id],
		relationName: "issues_createdByAgentId_agents_id"
	}),
	heartbeatRun_checkoutRunId: one(heartbeatRuns, {
		fields: [issues.checkoutRunId],
		references: [heartbeatRuns.id],
		relationName: "issues_checkoutRunId_heartbeatRuns_id"
	}),
	heartbeatRun_executionRunId: one(heartbeatRuns, {
		fields: [issues.executionRunId],
		references: [heartbeatRuns.id],
		relationName: "issues_executionRunId_heartbeatRuns_id"
	}),
	executionWorkspace: one(executionWorkspaces, {
		fields: [issues.executionWorkspaceId],
		references: [executionWorkspaces.id]
	}),
	issueLabels: many(issueLabels),
	issueApprovals: many(issueApprovals),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	costEvents: many(costEvents),
	company: one(companies, {
		fields: [projects.companyId],
		references: [companies.id]
	}),
	goal: one(goals, {
		fields: [projects.goalId],
		references: [goals.id]
	}),
	agent: one(agents, {
		fields: [projects.leadAgentId],
		references: [agents.id]
	}),
	projectWorkspaces: many(projectWorkspaces),
	executionWorkspaces: many(executionWorkspaces),
	issues: many(issues),
	projectConventions: many(projectConventions),
	projectGoals: many(projectGoals),
}));

export const goalsRelations = relations(goals, ({one, many}) => ({
	costEvents: many(costEvents),
	company: one(companies, {
		fields: [goals.companyId],
		references: [companies.id]
	}),
	goal: one(goals, {
		fields: [goals.parentId],
		references: [goals.id],
		relationName: "goals_parentId_goals_id"
	}),
	goals: many(goals, {
		relationName: "goals_parentId_goals_id"
	}),
	agent: one(agents, {
		fields: [goals.ownerAgentId],
		references: [agents.id]
	}),
	projects: many(projects),
	issues: many(issues),
	projectGoals: many(projectGoals),
}));

export const issueCommentsRelations = relations(issueComments, ({one, many}) => ({
	company: one(companies, {
		fields: [issueComments.companyId],
		references: [companies.id]
	}),
	issue: one(issues, {
		fields: [issueComments.issueId],
		references: [issues.id]
	}),
	agent: one(agents, {
		fields: [issueComments.authorAgentId],
		references: [agents.id]
	}),
	issueAttachments: many(issueAttachments),
}));

export const heartbeatRunsRelations = relations(heartbeatRuns, ({one, many}) => ({
	company: one(companies, {
		fields: [heartbeatRuns.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [heartbeatRuns.agentId],
		references: [agents.id]
	}),
	agentWakeupRequest: one(agentWakeupRequests, {
		fields: [heartbeatRuns.wakeupRequestId],
		references: [agentWakeupRequests.id]
	}),
	heartbeatRunEvents: many(heartbeatRunEvents),
	activityLogs: many(activityLog),
	agentTaskSessions: many(agentTaskSessions),
	issues_checkoutRunId: many(issues, {
		relationName: "issues_checkoutRunId_heartbeatRuns_id"
	}),
	issues_executionRunId: many(issues, {
		relationName: "issues_executionRunId_heartbeatRuns_id"
	}),
}));

export const agentWakeupRequestsRelations = relations(agentWakeupRequests, ({one, many}) => ({
	heartbeatRuns: many(heartbeatRuns),
	company: one(companies, {
		fields: [agentWakeupRequests.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [agentWakeupRequests.agentId],
		references: [agents.id]
	}),
}));

export const agentRuntimeStateRelations = relations(agentRuntimeState, ({one}) => ({
	agent: one(agents, {
		fields: [agentRuntimeState.agentId],
		references: [agents.id]
	}),
	company: one(companies, {
		fields: [agentRuntimeState.companyId],
		references: [companies.id]
	}),
}));

export const heartbeatRunEventsRelations = relations(heartbeatRunEvents, ({one}) => ({
	company: one(companies, {
		fields: [heartbeatRunEvents.companyId],
		references: [companies.id]
	}),
	heartbeatRun: one(heartbeatRuns, {
		fields: [heartbeatRunEvents.runId],
		references: [heartbeatRuns.id]
	}),
	agent: one(agents, {
		fields: [heartbeatRunEvents.agentId],
		references: [agents.id]
	}),
}));

export const activityLogRelations = relations(activityLog, ({one}) => ({
	company: one(companies, {
		fields: [activityLog.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [activityLog.agentId],
		references: [agents.id]
	}),
	heartbeatRun: one(heartbeatRuns, {
		fields: [activityLog.runId],
		references: [heartbeatRuns.id]
	}),
}));

export const approvalCommentsRelations = relations(approvalComments, ({one}) => ({
	company: one(companies, {
		fields: [approvalComments.companyId],
		references: [companies.id]
	}),
	approval: one(approvals, {
		fields: [approvalComments.approvalId],
		references: [approvals.id]
	}),
	agent: one(agents, {
		fields: [approvalComments.authorAgentId],
		references: [agents.id]
	}),
}));

export const agentConfigRevisionsRelations = relations(agentConfigRevisions, ({one}) => ({
	company: one(companies, {
		fields: [agentConfigRevisions.companyId],
		references: [companies.id]
	}),
	agent_agentId: one(agents, {
		fields: [agentConfigRevisions.agentId],
		references: [agents.id],
		relationName: "agentConfigRevisions_agentId_agents_id"
	}),
	agent_createdByAgentId: one(agents, {
		fields: [agentConfigRevisions.createdByAgentId],
		references: [agents.id],
		relationName: "agentConfigRevisions_createdByAgentId_agents_id"
	}),
}));

export const agentTaskSessionsRelations = relations(agentTaskSessions, ({one}) => ({
	company: one(companies, {
		fields: [agentTaskSessions.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [agentTaskSessions.agentId],
		references: [agents.id]
	}),
	heartbeatRun: one(heartbeatRuns, {
		fields: [agentTaskSessions.lastRunId],
		references: [heartbeatRuns.id]
	}),
}));

export const companySecretsRelations = relations(companySecrets, ({one, many}) => ({
	company: one(companies, {
		fields: [companySecrets.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [companySecrets.createdByAgentId],
		references: [agents.id]
	}),
	companySecretVersions: many(companySecretVersions),
}));

export const companySecretVersionsRelations = relations(companySecretVersions, ({one}) => ({
	companySecret: one(companySecrets, {
		fields: [companySecretVersions.secretId],
		references: [companySecrets.id]
	}),
	agent: one(agents, {
		fields: [companySecretVersions.createdByAgentId],
		references: [agents.id]
	}),
}));

export const assetsRelations = relations(assets, ({one, many}) => ({
	company: one(companies, {
		fields: [assets.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [assets.createdByAgentId],
		references: [agents.id]
	}),
	issueAttachments: many(issueAttachments),
}));

export const issueAttachmentsRelations = relations(issueAttachments, ({one}) => ({
	company: one(companies, {
		fields: [issueAttachments.companyId],
		references: [companies.id]
	}),
	issue: one(issues, {
		fields: [issueAttachments.issueId],
		references: [issues.id]
	}),
	asset: one(assets, {
		fields: [issueAttachments.assetId],
		references: [assets.id]
	}),
	issueComment: one(issueComments, {
		fields: [issueAttachments.issueCommentId],
		references: [issueComments.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	sessions: many(session),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const companyMembershipsRelations = relations(companyMemberships, ({one}) => ({
	company: one(companies, {
		fields: [companyMemberships.companyId],
		references: [companies.id]
	}),
}));

export const invitesRelations = relations(invites, ({one, many}) => ({
	company: one(companies, {
		fields: [invites.companyId],
		references: [companies.id]
	}),
	joinRequests: many(joinRequests),
}));

export const principalPermissionGrantsRelations = relations(principalPermissionGrants, ({one}) => ({
	company: one(companies, {
		fields: [principalPermissionGrants.companyId],
		references: [companies.id]
	}),
}));

export const labelsRelations = relations(labels, ({one, many}) => ({
	company: one(companies, {
		fields: [labels.companyId],
		references: [companies.id]
	}),
	issueLabels: many(issueLabels),
}));

export const projectWorkspacesRelations = relations(projectWorkspaces, ({one, many}) => ({
	company: one(companies, {
		fields: [projectWorkspaces.companyId],
		references: [companies.id]
	}),
	project: one(projects, {
		fields: [projectWorkspaces.projectId],
		references: [projects.id]
	}),
	executionWorkspaces: many(executionWorkspaces),
}));

export const joinRequestsRelations = relations(joinRequests, ({one}) => ({
	invite: one(invites, {
		fields: [joinRequests.inviteId],
		references: [invites.id]
	}),
	company: one(companies, {
		fields: [joinRequests.companyId],
		references: [companies.id]
	}),
	agent: one(agents, {
		fields: [joinRequests.createdAgentId],
		references: [agents.id]
	}),
}));

export const executionWorkspacesRelations = relations(executionWorkspaces, ({one, many}) => ({
	company: one(companies, {
		fields: [executionWorkspaces.companyId],
		references: [companies.id]
	}),
	project: one(projects, {
		fields: [executionWorkspaces.projectId],
		references: [projects.id]
	}),
	projectWorkspace: one(projectWorkspaces, {
		fields: [executionWorkspaces.projectWorkspaceId],
		references: [projectWorkspaces.id]
	}),
	issues: many(issues),
}));

export const projectConventionsRelations = relations(projectConventions, ({one}) => ({
	company: one(companies, {
		fields: [projectConventions.companyId],
		references: [companies.id]
	}),
	project: one(projects, {
		fields: [projectConventions.projectId],
		references: [projects.id]
	}),
}));

export const issueLabelsRelations = relations(issueLabels, ({one}) => ({
	issue: one(issues, {
		fields: [issueLabels.issueId],
		references: [issues.id]
	}),
	label: one(labels, {
		fields: [issueLabels.labelId],
		references: [labels.id]
	}),
	company: one(companies, {
		fields: [issueLabels.companyId],
		references: [companies.id]
	}),
}));

export const projectGoalsRelations = relations(projectGoals, ({one}) => ({
	project: one(projects, {
		fields: [projectGoals.projectId],
		references: [projects.id]
	}),
	goal: one(goals, {
		fields: [projectGoals.goalId],
		references: [goals.id]
	}),
	company: one(companies, {
		fields: [projectGoals.companyId],
		references: [companies.id]
	}),
}));

export const issueApprovalsRelations = relations(issueApprovals, ({one}) => ({
	company: one(companies, {
		fields: [issueApprovals.companyId],
		references: [companies.id]
	}),
	issue: one(issues, {
		fields: [issueApprovals.issueId],
		references: [issues.id]
	}),
	approval: one(approvals, {
		fields: [issueApprovals.approvalId],
		references: [approvals.id]
	}),
	agent: one(agents, {
		fields: [issueApprovals.linkedByAgentId],
		references: [agents.id]
	}),
}));
