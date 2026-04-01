---
title: Natural Language Scheduling
status: completed
priority: P1
milestone: post-mvp
source: ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md
dependencies: [heartbeat-scheduler]
---

# Natural Language Scheduling

## Description

Add a natural-language parser that converts plain-English scheduling expressions ("Every Monday at 9am, check customer inquiries") into structured schedule records in the database. Also support an optional HEARTBEAT.md file in the workspace directory as an alternative to the form-based scheduler — when present, the file is parsed on project load and its entries are synced to the schedules table.

This removes the technical barrier of interval syntax (`5m`, `2h`, cron expressions) for the non-technical solo founder persona. A user should be able to describe what they want in natural language and have it just work.

## User Story

As a non-technical solo founder, I want to type "Run my marketing report every Monday at 9am" and have the schedule created automatically, so that I don't need to learn cron syntax or fill out complex forms.

## Technical Approach

### NLP Scheduling Parser

New module: `src/lib/schedules/nlp-parser.ts`

**Input:** Natural language string (e.g., "Every weekday at 8:30am", "Check invoices on the 1st and 15th of each month", "Every 2 hours during business hours")

**Output:** Structured schedule parameters:
```typescript
interface ParsedSchedule {
  intervalMs?: number;           // For simple intervals
  cronExpression?: string;       // For complex patterns
  type: 'scheduled' | 'heartbeat';
  activeHoursStart?: number;     // 0-23
  activeHoursEnd?: number;       // 0-23
  activeTimezone?: string;       // IANA timezone
  dayOfWeek?: number[];          // 0-6 (Sun-Sat)
  dayOfMonth?: number[];         // 1-31
  description: string;           // Human-readable summary of what was parsed
  confidence: number;            // 0-1, how confident the parser is in the interpretation
}
```

**Parsing strategy:**
1. **Pattern matching first**: Use regex patterns for common scheduling expressions (every N minutes/hours/days, every [weekday], on the Nth of each month, at [time]). This handles 80% of cases without an LLM call.
2. **LLM fallback**: For complex or ambiguous expressions, use a single LLM call with a structured output schema to interpret the schedule. This uses the cheapest available model (Haiku or equivalent) to minimize cost.
3. **Confidence threshold**: If pattern matching produces confidence >= 0.9, use it directly. If 0.7-0.9, show the interpretation to the user for confirmation. Below 0.7, fall back to LLM.
4. **Timezone inference**: Default to the user's browser timezone (from settings) unless explicitly specified in the text.

### HEARTBEAT.md File Support

New module: `src/lib/schedules/heartbeat-file-parser.ts`

**File format** (workspace-local, in project's working directory):

```markdown
# Heartbeat Schedule

## Every weekday at 8:30am
Check customer inbox for unread inquiries older than 2 hours.
Flag any urgent items for immediate response.

## Every Monday at 9am
Generate weekly marketing performance report.
Compare against previous week's metrics.

## Every 2 hours during business hours (9am-6pm EST)
Monitor social media mentions and compile summary.
```

**Parsing flow:**
1. On project load (or when workspace context is refreshed), check for `HEARTBEAT.md` in the project's working directory
2. Parse each `## heading` as a scheduling expression → run through NLP parser
3. Parse the body text under each heading as the heartbeat checklist items
4. Reconcile with existing schedules in the database:
   - New entries: create schedule records (type: heartbeat)
   - Changed entries: update existing schedule records
   - Removed entries: mark schedules as paused (not deleted — protect against accidental file edits)
5. Display a reconciliation summary in the UI showing what was synced

### Chat Integration

Extend the chat engine to detect scheduling intent in user messages:

- When a message matches scheduling patterns ("schedule", "every", "at X o'clock", "remind me"), parse it as a potential schedule
- Present the parsed interpretation inline: "I understood: Run marketing report every Monday at 9:00 AM. Create this schedule?"
- On confirmation, create the schedule record directly from chat

### UI Enhancements

1. **Natural language input field**: Add a text input at the top of the schedule creation form with placeholder "Type a schedule in plain English..." that auto-fills the structured form fields as the user types
2. **Parse preview**: Show real-time interpretation of the natural language input below the text field ("Understood: Every Monday at 9:00 AM EST")
3. **Confidence indicator**: Show green (high confidence), yellow (medium, confirm), or red (low, suggest form) indicator next to the interpretation
4. **HEARTBEAT.md status**: On the schedules page, if a HEARTBEAT.md file exists in the active project's workspace, show a badge indicating file-synced schedules

## Acceptance Criteria

- [ ] NLP parser correctly interprets common scheduling expressions: "every N hours", "every Monday", "at 9am", "every weekday", "on the 1st of each month", "every 2 hours during business hours"
- [ ] Pattern matching handles 80%+ of common expressions without LLM call
- [ ] LLM fallback handles complex/ambiguous expressions with structured output
- [ ] Confidence scoring: high (>0.9) auto-creates, medium (0.7-0.9) shows confirmation, low (<0.7) suggests form
- [ ] HEARTBEAT.md file is detected and parsed on project load
- [ ] File-to-database reconciliation: creates, updates, and pauses schedules correctly
- [ ] Chat messages with scheduling intent trigger inline schedule creation
- [ ] Schedule creation form has natural language input field with real-time parse preview
- [ ] Timezone defaults to user's setting unless explicitly specified
- [ ] Existing interval parser (`src/lib/schedules/interval-parser.ts`) is not affected

## Scope Boundaries

**Included:**
- Natural language → structured schedule parser
- HEARTBEAT.md file parsing and database reconciliation
- Chat-based schedule creation
- Natural language input on schedule creation form
- Confidence-based confirmation flow

**Excluded:**
- Self-modifying HEARTBEAT.md (agent writing back to the file) — read-only for now
- Complex recurrence rules (e.g., "every third Thursday except holidays") — handle via LLM fallback
- Calendar integration (Google Calendar, Outlook) — future MCP integration
- Voice-based scheduling — text input only

## References

- Source: `ideas/vision/Stagent-OpenClaw-Companion-Research-Report.md` — Section 3.8 (HEARTBEAT.md as Natural-Language Cron)
- Existing interval parser: `src/lib/schedules/interval-parser.ts`
- Existing scheduler: `src/lib/schedules/scheduler.ts`
- Related features: heartbeat-scheduler (provides the heartbeat schedule type this feature creates)
