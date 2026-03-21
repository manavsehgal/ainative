---
name: writing-plans-overrides
description: "Project-level overrides for the superpowers writing-plans skill. Adds scope challenge step and required plan sections to every implementation plan."
---

# Writing Plans — Project Overrides

These overrides augment the base `superpowers:writing-plans` skill. Apply these rules IN ADDITION to the plugin's base behavior.

## Scope Challenge Step

Before writing the plan, perform a scope challenge. Ask these questions (internally or to the user):

1. **Is this overbuilt?** — Are there components in the spec that add complexity without proportional value?
2. **Can we reuse existing code?** — Grep the codebase for utilities, patterns, or components that already solve part of this.
3. **Can scope be compressed?** — Is there a simpler architecture that delivers 80% of the value?

Present the challenge result with three paths:
- **REDUCE scope** — [what to cut and why]
- **PROCEED as-is** — [confirmation that scope is right-sized]
- **EXPAND scope** — [what's missing that would make this significantly more valuable]

Wait for user confirmation before proceeding to plan writing.

## Required Plan Sections

Every plan must include these sections (in addition to the standard task structure):

- **"NOT in scope"** — explicit list of what this plan does NOT cover, with rationale for each deferral
- **"What already exists"** — code, utilities, and patterns found during scope challenge that can be reused
- **Error & Rescue Registry** (for non-trivial features) — table mapping failure modes to recovery strategies
