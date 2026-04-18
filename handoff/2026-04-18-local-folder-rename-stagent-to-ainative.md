# Handoff: Rename local dev folder `stagent` → `ainative`

**Date:** 2026-04-18
**Author:** Manav Sehgal (with Claude assist)
**Context:** GitHub repo already migrated from `stagent` → `ainative`. npm package already migrated. Local dev folder at `/Users/manavsehgal/Developer/stagent` is the last surface still carrying the old name. This handoff captures the rename plan so it can be resumed in a fresh session after the folder move.

---

## Why this handoff exists

The rename itself (`mv /Users/manavsehgal/Developer/stagent /Users/manavsehgal/Developer/ainative`) must happen from **outside** any Claude Code / Codex session, because those sessions have the old path as cwd. Once the user has:

1. Closed all Claude Code + Codex sessions on the folder
2. Run `mv` on the folder
3. Run `mv` on the Claude Code memory dir (see step 3 below)
4. Restarted Claude Code from the new folder

…a new session can finish the external-config sweep. This doc is the contract for that new session.

## What was already verified (do not re-investigate)

- **Zero hardcoded `Developer/stagent` references inside the project.** Source code, `.env.local`, tests, skills under `.claude/skills/` — all portable. Confirmed via `grep -rn "Developer/stagent" .` from the project root returning 0 hits.
- **The `~/.stagent/` data dir is independent of the folder name.** Keep as-is. It holds the DB and uploads and is not affected by the folder rename.
- **Historical log references** (thousands in `~/.codex/sessions/**/*.jsonl`, `~/.codex/log/codex-tui.log`, `~/.claude/projects/.../*.jsonl`, `~/.claude/history.jsonl`, `~/.claude/backups/`, `~/.npm/_logs/`) are not read at runtime. **Ignore all of them.**
- **`~/.stagent.bak-pre-rename-2026-04-17/`** is a pre-existing stale backup from an earlier unrelated effort. Ignore.

## Decisions already made (do not re-litigate)

1. **New folder path:** `/Users/manavsehgal/Developer/ainative`
2. **Rename the Claude Code memory dir** so `MEMORY.md` carries over (see step 3 below). Alternative (let Claude Code create a fresh memory dir and start blank) was rejected.
3. **Do NOT rename the `~/.stagent/` data dir or the DB name** in this task. Separate decision, not in scope.
4. **Do NOT rename the npm package, CLI command, or `repository.url`** in this task. Those were already handled in the earlier ainative pivot.
5. **Skip historical session logs and caches** even though they contain thousands of `stagent` references.

## Step-by-step plan

### Step 1 — User (outside any Claude/Codex session)

Close all Claude Code + Codex sessions on the folder.

### Step 2 — User (shell)

```bash
mv /Users/manavsehgal/Developer/stagent /Users/manavsehgal/Developer/ainative
```

### Step 3 — User (shell)

Rename the Claude Code project-memory directory so `MEMORY.md` and per-memory files carry over:

```bash
mv ~/.claude/projects/-Users-manavsehgal-Developer-stagent \
   ~/.claude/projects/-Users-manavsehgal-Developer-ainative
```

(Claude Code derives the memory dir name by replacing `/` with `-` in the project absolute path. Without this rename, the new session would see an empty memory dir.)

### Step 4 — User

Restart Claude Code from `/Users/manavsehgal/Developer/ainative`. Point the new session at this handoff doc.

### Step 5 — Claude (new session) — external config sweep

Update the following **7 surfaces**. All are outside the project. In each, replace `/Users/manavsehgal/Developer/stagent` → `/Users/manavsehgal/Developer/ainative`.

| # | Path | Expected hits | Notes |
|---|---|---|---|
| 1 | `~/.claude.json` | ~36 | Claude Code project registry. JSON keys + values. Back it up first: `cp ~/.claude.json ~/.claude.json.bak-pre-folder-rename` |
| 2 | `~/.codex/config.toml` | 1 | `[projects."…/stagent"]` section header |
| 3 | `~/.codex/.codex-global-state.json` | 1 | last-used project |
| 4 | `~/.codex/rules/default.rules` | 17 | `prefix_rule` command allowlists — exact-string match, so stale entries stop matching |
| 5 | `~/.codex/skills/*/SKILL.md` | ~36 | 10 skills with absolute links into project: `doc-generator`, `docx`, `xlsx`, `code-review`, `book-updater`, `worktree-production`, `architect`, `pptx`, `frontend-design`, `user-guide-sync` |
| 6 | `~/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/feedback-default-main-not-worktree.md` | 1 | prose path reference |
| 6 | `~/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/feedback-only-restart-own-dev-server.md` | 3 | prose path references (lines 7, 13, 15) — includes `pkill -f` pattern and `nohup` cwd |
| 6 | `~/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/instance-bootstrap-dev-gate.md` | 1 | prose reference (line 9) |
| 6 | `~/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/shared-stagent-data-dir.md` | 1 | prose reference (line 10) — note the filename itself contains "stagent" referring to the DB dir, which is unchanged; file stays named as-is |
| 7 | `MEMORY.md` (inside memory dir) | scan for any | cross-check after the above; likely clean |

### Step 6 — Claude — verify

```bash
grep -rn "Developer/stagent" \
  ~/.claude.json \
  ~/.codex/config.toml \
  ~/.codex/rules/default.rules \
  ~/.codex/.codex-global-state.json \
  ~/.codex/skills/ \
  ~/.claude/projects/-Users-manavsehgal-Developer-ainative/memory/
```

**Expected:** zero hits. If any remain, they are either (a) inside historical JSONL logs (ignore) or (b) a missed active config (fix).

### Step 7 — Claude — smoke test

- From the new folder: `npm run dev` starts cleanly on :3000
- A Codex allowlisted command that used to just-work should still just-work (e.g., one of the screenshot commands from `default.rules`) — otherwise some `prefix_rule` didn't get rewritten
- Claude Code `MEMORY.md` loads normally on session start (confirmed if this very doc can be opened by pointing at this handoff's relative path)

## Post-rename CLAUDE.md / MEMORY.md touch-ups

After the sweep, add a short memory note:

- **What changed:** local dev folder renamed from `stagent` to `ainative` on 2026-04-18
- **What did NOT change:** `~/.stagent/` data dir, `~/.stagent/stagent.db` DB name, `STAGENT_DATA_DIR` env var, `STAGENT_DEV_MODE` env var, `STAGENT_INSTANCE_MODE` env var. All these retain the "stagent" prefix because they are data-layer identifiers, not folder-name identifiers.

Also consider updating these MEMORY.md entries so the prose stays accurate:
- `shared-stagent-data-dir.md` — filename can stay (DB dir is still `~/.stagent/`); body path reference to main repo needs the new folder path
- `feedback-only-restart-own-dev-server.md` — `pkill -f` pattern must anchor on `/Developer/ainative/node_modules` now, not `/Developer/stagent/node_modules`

## Out of scope

- Renaming `~/.stagent/` DB dir
- Renaming `STAGENT_*` env vars
- Renaming the `stagent` CLI command or npm package
- Cleaning up historical session JSONL files
- Renaming sibling clones (`stagent-wealth`, `stagent-venture`, `stagent-growth`, `stagent.github.io`) — those are separate folders and unaffected by this rename

## Rollback

If something breaks mid-sweep:

```bash
# Restore the Claude Code registry (this was backed up in step 5.1)
cp ~/.claude.json.bak-pre-folder-rename ~/.claude.json

# Undo the folder rename
mv /Users/manavsehgal/Developer/ainative /Users/manavsehgal/Developer/stagent

# Undo the memory dir rename
mv ~/.claude/projects/-Users-manavsehgal-Developer-ainative \
   ~/.claude/projects/-Users-manavsehgal-Developer-stagent
```

Codex configs don't have a built-in backup; back up `~/.codex/config.toml` and `~/.codex/rules/default.rules` before editing if you want rollback-safety there too.
