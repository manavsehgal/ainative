import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InferSelectModel } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  workingDirectory: text("working_directory"),
  status: text("status", { enum: ["active", "paused", "completed"] })
    .default("active")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    workflowId: text("workflow_id").references(() => workflows.id),
    scheduleId: text("schedule_id").references(() => schedules.id),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["planned", "queued", "running", "completed", "failed", "cancelled"],
    })
      .default("planned")
      .notNull(),
    assignedAgent: text("assigned_agent"),
    agentProfile: text("agent_profile"),
    priority: integer("priority").default(2).notNull(),
    result: text("result"),
    sessionId: text("session_id"),
    resumeCount: integer("resume_count").default(0).notNull(),
    /** How this task was created: manual, scheduled, heartbeat, or workflow */
    sourceType: text("source_type", {
      enum: ["manual", "scheduled", "heartbeat", "workflow"],
    }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_tasks_status").on(table.status),
    index("idx_tasks_project_id").on(table.projectId),
    index("idx_tasks_workflow_id").on(table.workflowId),
    index("idx_tasks_schedule_id").on(table.scheduleId),
    index("idx_tasks_agent_profile").on(table.agentProfile),
  ]
);

export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name").notNull(),
  definition: text("definition").notNull(),
  status: text("status", {
    enum: ["draft", "active", "paused", "completed", "failed"],
  })
    .default("draft")
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const agentLogs = sqliteTable(
  "agent_logs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    agentType: text("agent_type").notNull(),
    event: text("event").notNull(),
    payload: text("payload"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_agent_logs_task_id").on(table.taskId),
    index("idx_agent_logs_timestamp").on(table.timestamp),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    type: text("type", {
      enum: [
        "permission_required",
        "task_completed",
        "task_failed",
        "agent_message",
        "budget_alert",
        "context_proposal",
        "context_proposal_batch",
      ],
    }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    read: integer("read", { mode: "boolean" }).default(false).notNull(),
    toolName: text("tool_name"),
    toolInput: text("tool_input"),
    response: text("response"),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_notifications_task_id").on(table.taskId),
    index("idx_notifications_read").on(table.read),
  ]
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    projectId: text("project_id").references(() => projects.id),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storagePath: text("storage_path").notNull(),
    version: integer("version").default(1).notNull(),
    direction: text("direction", { enum: ["input", "output"] })
      .default("input")
      .notNull(),
    category: text("category"),
    status: text("status", {
      enum: ["uploaded", "processing", "ready", "error"],
    })
      .default("uploaded")
      .notNull(),
    extractedText: text("extracted_text"),
    processedPath: text("processed_path"),
    processingError: text("processing_error"),
    source: text("source").default("upload"),
    conversationId: text("conversation_id").references(() => conversations.id),
    messageId: text("message_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_documents_task_id").on(table.taskId),
    index("idx_documents_project_id").on(table.projectId),
    index("idx_documents_source").on(table.source),
    index("idx_documents_conversation_id").on(table.conversationId),
  ]
);

export const schedules = sqliteTable(
  "schedules",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    name: text("name").notNull(),
    prompt: text("prompt").notNull(),
    cronExpression: text("cron_expression").notNull(),
    assignedAgent: text("assigned_agent"),
    agentProfile: text("agent_profile"),
    recurs: integer("recurs", { mode: "boolean" }).default(true).notNull(),
    status: text("status", {
      enum: ["active", "paused", "completed", "expired"],
    })
      .default("active")
      .notNull(),
    maxFirings: integer("max_firings"),
    firingCount: integer("firing_count").default(0).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    lastFiredAt: integer("last_fired_at", { mode: "timestamp" }),
    nextFireAt: integer("next_fire_at", { mode: "timestamp" }),
    /** 'scheduled' (default, clock-driven) or 'heartbeat' (intelligence-driven) */
    type: text("type", { enum: ["scheduled", "heartbeat"] })
      .default("scheduled")
      .notNull(),
    /** JSON array of checklist items the agent evaluates (heartbeat only) */
    heartbeatChecklist: text("heartbeat_checklist"),
    /** Hour of day (0-23) when heartbeats are active */
    activeHoursStart: integer("active_hours_start"),
    /** Hour of day (0-23) when heartbeats stop */
    activeHoursEnd: integer("active_hours_end"),
    /** Timezone for active hours windowing */
    activeTimezone: text("active_timezone").default("UTC"),
    /** Consecutive suppressed (no-action) heartbeat runs */
    suppressionCount: integer("suppression_count").default(0).notNull(),
    /** Timestamp of last heartbeat run that produced action */
    lastActionAt: integer("last_action_at", { mode: "timestamp" }),
    /** Daily budget cap for heartbeat evaluations (in microdollars) */
    heartbeatBudgetPerDay: integer("heartbeat_budget_per_day"),
    /** Spend so far today for heartbeat evaluations (in microdollars) */
    heartbeatSpentToday: integer("heartbeat_spent_today").default(0).notNull(),
    /** When the daily heartbeat budget was last reset */
    heartbeatBudgetResetAt: integer("heartbeat_budget_reset_at", {
      mode: "timestamp",
    }),
    /** JSON array of channel config IDs for delivery after firing */
    deliveryChannels: text("delivery_channels"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_schedules_status").on(table.status),
    index("idx_schedules_next_fire_at").on(table.nextFireAt),
    index("idx_schedules_project_id").on(table.projectId),
  ]
);

export const learnedContext = sqliteTable(
  "learned_context",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    version: integer("version").notNull(),
    content: text("content"),
    diff: text("diff"),
    changeType: text("change_type", {
      enum: [
        "proposal",
        "approved",
        "rejected",
        "rollback",
        "summarization",
      ],
    }).notNull(),
    sourceTaskId: text("source_task_id").references(() => tasks.id),
    proposalNotificationId: text("proposal_notification_id"),
    proposedAdditions: text("proposed_additions"),
    approvedBy: text("approved_by"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_learned_context_profile_version").on(
      table.profileId,
      table.version
    ),
    index("idx_learned_context_change_type").on(table.changeType),
  ]
);

export const agentMemory = sqliteTable(
  "agent_memory",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    category: text("category", {
      enum: ["fact", "preference", "pattern", "outcome"],
    }).notNull(),
    content: text("content").notNull(),
    confidence: integer("confidence").default(700).notNull(), // 0-1000 scale (700 = 0.7)
    sourceTaskId: text("source_task_id").references(() => tasks.id),
    tags: text("tags"), // JSON array
    lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
    accessCount: integer("access_count").default(0).notNull(),
    decayRate: integer("decay_rate").default(10).notNull(), // per-day decay in thousandths (10 = 0.01/day)
    status: text("status", {
      enum: ["active", "decayed", "archived", "rejected"],
    })
      .default("active")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_agent_memory_profile_status").on(table.profileId, table.status),
    index("idx_agent_memory_confidence").on(table.confidence),
  ]
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const usageLedger = sqliteTable(
  "usage_ledger",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").references(() => tasks.id),
    workflowId: text("workflow_id").references(() => workflows.id),
    scheduleId: text("schedule_id").references(() => schedules.id),
    projectId: text("project_id").references(() => projects.id),
    activityType: text("activity_type", {
      enum: [
        "task_run",
        "task_resume",
        "workflow_step",
        "scheduled_firing",
        "task_assist",
        "profile_test",
        "pattern_extraction",
        "context_summarization",
        "chat_turn",
        "profile_assist",
      ],
    }).notNull(),
    runtimeId: text("runtime_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id"),
    status: text("status", {
      enum: ["completed", "failed", "cancelled", "blocked", "unknown_pricing"],
    }).notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    costMicros: integer("cost_micros"),
    pricingVersion: text("pricing_version"),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_usage_ledger_task_id").on(table.taskId),
    index("idx_usage_ledger_activity_type").on(table.activityType),
    index("idx_usage_ledger_runtime_id").on(table.runtimeId),
    index("idx_usage_ledger_provider_model").on(table.providerId, table.modelId),
    index("idx_usage_ledger_finished_at").on(table.finishedAt),
  ]
);

export const views = sqliteTable(
  "views",
  {
    id: text("id").primaryKey(),
    /** Surface this view belongs to (e.g., "tasks", "documents", "workflows") */
    surface: text("surface").notNull(),
    /** User-assigned name for the view */
    name: text("name").notNull(),
    /** JSON-serialized filter state */
    filters: text("filters"),
    /** JSON-serialized sort state (column + direction) */
    sorting: text("sorting"),
    /** JSON-serialized column visibility state */
    columns: text("columns"),
    /** Density preference: compact | comfortable | spacious */
    density: text("density", {
      enum: ["compact", "comfortable", "spacious"],
    }).default("comfortable"),
    /** Whether this is the default view for the surface */
    isDefault: integer("is_default", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_views_surface").on(table.surface),
    index("idx_views_surface_default").on(table.surface, table.isDefault),
  ]
);

// ── Environment onboarding tables ──────────────────────────────────────

export const environmentScans = sqliteTable(
  "environment_scans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    scanPath: text("scan_path").notNull(),
    persona: text("persona").notNull(), // JSON array of ToolPersona[]
    scanStatus: text("scan_status", {
      enum: ["running", "completed", "failed"],
    })
      .default("running")
      .notNull(),
    artifactCount: integer("artifact_count").default(0).notNull(),
    durationMs: integer("duration_ms"),
    errors: text("errors"), // JSON array of ScanError[]
    scannedAt: integer("scanned_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_env_scans_project_id").on(table.projectId),
    index("idx_env_scans_scanned_at").on(table.scannedAt),
  ]
);

export const environmentArtifacts = sqliteTable(
  "environment_artifacts",
  {
    id: text("id").primaryKey(),
    scanId: text("scan_id")
      .references(() => environmentScans.id)
      .notNull(),
    tool: text("tool").notNull(), // ToolPersona
    category: text("category").notNull(), // ArtifactCategory
    scope: text("scope").notNull(), // ArtifactScope
    name: text("name").notNull(),
    relPath: text("rel_path").notNull(),
    absPath: text("abs_path").notNull(),
    contentHash: text("content_hash").notNull(),
    preview: text("preview"),
    metadata: text("metadata"), // JSON
    sizeBytes: integer("size_bytes").default(0).notNull(),
    modifiedAt: integer("modified_at").notNull(), // epoch ms
    linkedProfileId: text("linked_profile_id"), // profile ID if this artifact is linked to a profile
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_env_artifacts_scan_id").on(table.scanId),
    index("idx_env_artifacts_category").on(table.category),
    index("idx_env_artifacts_tool").on(table.tool),
    index("idx_env_artifacts_scan_tool").on(table.scanId, table.tool),
    index("idx_env_artifacts_scan_category").on(table.scanId, table.category),
    index("idx_env_artifacts_linked_profile").on(table.linkedProfileId),
  ]
);

export const environmentCheckpoints = sqliteTable(
  "environment_checkpoints",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    label: text("label").notNull(),
    checkpointType: text("checkpoint_type", {
      enum: ["pre-sync", "manual", "pre-onboard"],
    }).notNull(),
    gitTag: text("git_tag"),
    gitCommitSha: text("git_commit_sha"),
    backupPath: text("backup_path"),
    filesCount: integer("files_count").default(0).notNull(),
    status: text("status", {
      enum: ["active", "rolled_back", "superseded"],
    })
      .default("active")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_env_checkpoints_project_status").on(
      table.projectId,
      table.status
    ),
  ]
);

export const environmentSyncOps = sqliteTable(
  "environment_sync_ops",
  {
    id: text("id").primaryKey(),
    checkpointId: text("checkpoint_id")
      .references(() => environmentCheckpoints.id)
      .notNull(),
    artifactId: text("artifact_id").references(() => environmentArtifacts.id),
    operation: text("operation", {
      enum: ["create", "update", "delete", "sync"],
    }).notNull(),
    targetTool: text("target_tool").notNull(),
    targetPath: text("target_path").notNull(),
    diffPreview: text("diff_preview"),
    status: text("status", {
      enum: ["pending", "applied", "failed", "rolled_back"],
    })
      .default("pending")
      .notNull(),
    error: text("error"),
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_env_sync_ops_checkpoint_id").on(table.checkpointId)]
);

export const environmentTemplates = sqliteTable(
  "environment_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    manifest: text("manifest").notNull(), // JSON: { skills, mcpServers, permissions, instructions }
    scope: text("scope", { enum: ["user", "shared"] })
      .default("user")
      .notNull(),
    artifactCount: integer("artifact_count").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("idx_env_templates_scope").on(table.scope)]
);

// ── Chat conversation tables ───────────────────────────────────────────

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id),
    title: text("title"),
    runtimeId: text("runtime_id").notNull(),
    modelId: text("model_id"),
    status: text("status", { enum: ["active", "archived"] })
      .default("active")
      .notNull(),
    sessionId: text("session_id"),
    contextScope: text("context_scope"), // JSON: context config overrides
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_conversations_project_id").on(table.projectId),
    index("idx_conversations_status").on(table.status),
    index("idx_conversations_updated_at").on(table.updatedAt),
  ]
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .references(() => conversations.id)
      .notNull(),
    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata"), // JSON: token counts, model used, etc.
    status: text("status", {
      enum: ["pending", "streaming", "complete", "error"],
    })
      .default("complete")
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_chat_messages_conversation_id").on(table.conversationId),
    index("idx_chat_messages_conversation_created").on(
      table.conversationId,
      table.createdAt
    ),
  ]
);

// ── Profile test results ──────────────────────────────────────────────────

export const profileTestResults = sqliteTable(
  "profile_test_results",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id").notNull(),
    runtimeId: text("runtime_id").notNull(),
    reportJson: text("report_json").notNull(),
    totalPassed: integer("total_passed").default(0).notNull(),
    totalFailed: integer("total_failed").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_profile_test_results_profile_runtime").on(
      table.profileId,
      table.runtimeId
    ),
  ]
);

// ── Book reading progress & bookmarks ───────────────────────────────────

export const readingProgress = sqliteTable("reading_progress", {
  chapterId: text("chapter_id").primaryKey(),
  /** Fraction 0–1 of scroll progress (high-water mark) */
  progress: integer("progress").default(0).notNull(),
  /** Raw scroll position (pixels) for restoring exact location */
  scrollPosition: integer("scroll_position").default(0).notNull(),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id").notNull(),
    /** Section ID within the chapter (optional — null means chapter-level) */
    sectionId: text("section_id"),
    /** Scroll position in pixels for restoring location */
    scrollPosition: integer("scroll_position").default(0).notNull(),
    /** User-provided label or auto-generated from section title */
    label: text("label").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_bookmarks_chapter_id").on(table.chapterId),
  ]
);

export const repoImports = sqliteTable(
  "repo_imports",
  {
    id: text("id").primaryKey(),
    repoUrl: text("repo_url").notNull(),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha").notNull(),
    profileIds: text("profile_ids").notNull(), // JSON array of imported profile IDs
    skillCount: integer("skill_count").notNull(),
    lastCheckedAt: integer("last_checked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_repo_imports_repo_url").on(table.repoUrl),
    index("idx_repo_imports_owner_name").on(table.repoOwner, table.repoName),
  ]
);

// ── Multi-Channel Delivery ────────────────────────────────────────────

export const channelConfigs = sqliteTable(
  "channel_configs",
  {
    id: text("id").primaryKey(),
    channelType: text("channel_type", { enum: ["slack", "telegram", "webhook"] }).notNull(),
    name: text("name").notNull(),
    // SECURITY: The config JSON contains credentials (botToken, signingSecret, webhookSecret)
    // stored as plaintext. A future improvement should encrypt these at rest.
    // All API responses MUST mask sensitive fields via maskChannelConfig() before returning.
    config: text("config").notNull(), // JSON: { webhookUrl?, botToken?, chatId?, channelId?, signingSecret?, webhookSecret? }
    status: text("status", { enum: ["active", "disabled"] }).default("active").notNull(),
    testStatus: text("test_status", { enum: ["untested", "ok", "failed"] }).default("untested").notNull(),
    direction: text("direction", { enum: ["outbound", "bidirectional"] }).default("outbound").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_channel_configs_type").on(table.channelType),
  ]
);

export type ChannelConfigRow = InferSelectModel<typeof channelConfigs>;

// ── Bidirectional Channel Chat ────────────────────────────────────────

export const channelBindings = sqliteTable(
  "channel_bindings",
  {
    id: text("id").primaryKey(),
    channelConfigId: text("channel_config_id").references(() => channelConfigs.id).notNull(),
    conversationId: text("conversation_id").references(() => conversations.id).notNull(),
    externalThreadId: text("external_thread_id"),
    runtimeId: text("runtime_id").notNull(),
    modelId: text("model_id"),
    profileId: text("profile_id"),
    status: text("status", { enum: ["active", "paused", "archived"] }).default("active").notNull(),
    pendingRequestId: text("pending_request_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_channel_bindings_config").on(table.channelConfigId),
    index("idx_channel_bindings_conversation").on(table.conversationId),
    uniqueIndex("idx_channel_bindings_config_thread").on(table.channelConfigId, table.externalThreadId),
  ]
);

export type ChannelBindingRow = InferSelectModel<typeof channelBindings>;

// ── Agent Async Handoffs ──────────────────────────────────────────────

export const agentMessages = sqliteTable(
  "agent_messages",
  {
    id: text("id").primaryKey(),
    fromProfileId: text("from_profile_id").notNull(),
    toProfileId: text("to_profile_id").notNull(),
    taskId: text("task_id").references(() => tasks.id),
    targetTaskId: text("target_task_id").references(() => tasks.id),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    attachments: text("attachments"), // JSON
    priority: integer("priority").default(2).notNull(),
    status: text("status", {
      enum: ["pending", "accepted", "in_progress", "completed", "rejected", "expired"],
    }).default("pending").notNull(),
    requiresApproval: integer("requires_approval", { mode: "boolean" }).default(false).notNull(),
    approvedBy: text("approved_by"),
    parentMessageId: text("parent_message_id"),
    chainDepth: integer("chain_depth").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
  },
  (table) => [
    index("idx_agent_messages_to_status").on(table.toProfileId, table.status),
    index("idx_agent_messages_task").on(table.taskId),
  ]
);

// ── Workflow Document Pool ───────────────────────────────────────────

export const workflowDocumentInputs = sqliteTable(
  "workflow_document_inputs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .references(() => workflows.id)
      .notNull(),
    documentId: text("document_id")
      .references(() => documents.id)
      .notNull(),
    /** null = document available to all steps; set = scoped to specific step */
    stepId: text("step_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_wdi_workflow").on(table.workflowId),
    index("idx_wdi_document").on(table.documentId),
    uniqueIndex("idx_wdi_workflow_doc_step").on(
      table.workflowId,
      table.documentId,
      table.stepId
    ),
  ]
);

export type WorkflowDocumentInputRow = InferSelectModel<typeof workflowDocumentInputs>;

export const scheduleDocumentInputs = sqliteTable(
  "schedule_document_inputs",
  {
    id: text("id").primaryKey(),
    scheduleId: text("schedule_id")
      .references(() => schedules.id)
      .notNull(),
    documentId: text("document_id")
      .references(() => documents.id)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_sdi_schedule").on(table.scheduleId),
    uniqueIndex("idx_sdi_schedule_doc").on(
      table.scheduleId,
      table.documentId
    ),
  ]
);

export type ScheduleDocumentInputRow = InferSelectModel<typeof scheduleDocumentInputs>;

export const projectDocumentDefaults = sqliteTable(
  "project_document_defaults",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .references(() => projects.id)
      .notNull(),
    documentId: text("document_id")
      .references(() => documents.id)
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("idx_pdd_project").on(table.projectId),
    uniqueIndex("idx_pdd_project_doc").on(
      table.projectId,
      table.documentId
    ),
  ]
);

export type ProjectDocumentDefaultRow = InferSelectModel<typeof projectDocumentDefaults>;

// Shared types derived from schema — use these in components instead of `as any`
export type ProjectRow = InferSelectModel<typeof projects>;
export type TaskRow = InferSelectModel<typeof tasks>;
export type WorkflowRow = InferSelectModel<typeof workflows>;
export type AgentLogRow = InferSelectModel<typeof agentLogs>;
export type NotificationRow = InferSelectModel<typeof notifications>;
export type DocumentRow = InferSelectModel<typeof documents>;
export type ScheduleRow = InferSelectModel<typeof schedules>;
export type SettingsRow = InferSelectModel<typeof settings>;
export type LearnedContextRow = InferSelectModel<typeof learnedContext>;
export type AgentMemoryRow = InferSelectModel<typeof agentMemory>;
export type UsageLedgerRow = InferSelectModel<typeof usageLedger>;
export type ViewRow = InferSelectModel<typeof views>;
export type EnvironmentScanRow = InferSelectModel<typeof environmentScans>;
export type EnvironmentArtifactRow = InferSelectModel<typeof environmentArtifacts>;
export type EnvironmentCheckpointRow = InferSelectModel<typeof environmentCheckpoints>;
export type EnvironmentSyncOpRow = InferSelectModel<typeof environmentSyncOps>;
export type EnvironmentTemplateRow = InferSelectModel<typeof environmentTemplates>;
export type ConversationRow = InferSelectModel<typeof conversations>;
export type ChatMessageRow = InferSelectModel<typeof chatMessages>;
export type ProfileTestResultRow = InferSelectModel<typeof profileTestResults>;
export type ReadingProgressRow = InferSelectModel<typeof readingProgress>;
export type BookmarkRow = InferSelectModel<typeof bookmarks>;
export type RepoImportRow = InferSelectModel<typeof repoImports>;
export type AgentMessageRow = InferSelectModel<typeof agentMessages>;
