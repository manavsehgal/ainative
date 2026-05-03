/**
 * chat-conversation-branches v1 — feature flag.
 *
 * The schema and data-layer changes shipped behind this flag are always
 * present and tested (so they don't bit-rot), but the UI surfaces — the
 * "Branch from here" action, branch tree tab, and ⌘Z/⌘⇧Z keybindings —
 * only render when this returns `true`.
 *
 * Default-off until v1 validation completes. Flip to `true` per-developer
 * via `AINATIVE_CHAT_BRANCHING=true` in `.env.local`. Flag check is
 * synchronous so it can be used inline in render paths.
 *
 * The flag is intentionally a single function (not an object/registry):
 * the project has no broader feature-flag system today, and a single
 * env-var helper avoids inventing one for one feature.
 *
 * See `features/chat-conversation-branches.md`.
 */
export function isBranchingEnabled(): boolean {
  return process.env.AINATIVE_CHAT_BRANCHING === "true";
}
