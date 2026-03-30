---
title: Settings Interactive Controls
status: completed
priority: P2
milestone: post-mvp
source: kitchen-sink-03-23.md
dependencies: []
---

# Settings Interactive Controls

## Description

The Settings page uses plain number inputs for SDK Timeout and lacks a global Max Turns control entirely (Max Turns only exists per-profile in `profile.yaml` files). Users have no visual guidance about what values mean or what ranges are recommended for common use cases.

This feature upgrades SDK Timeout to an interactive slider with contextual labels and adds a new global Max Turns slider. Both controls include real-time value display, descriptive labels explaining the speed-vs-quality tradeoff, and a recommended range indicator.

## User Story

As a user, I want visual, interactive controls for timeout and turn limits with clear guidance, so I can confidently tune agent behavior without guessing what values are appropriate.

## Technical Approach

### 1. SDK Timeout Slider

Replace `<Input type="number">` in `runtime-timeout-section.tsx` with `<Slider>` component (already used in `budget-guardrails-section.tsx`, `book-reader.tsx`, `profile-form-view.tsx`, `workflow-form-view.tsx`).

- Range: 10–300 seconds, step 5, default 60
- Labels: "Fast Response" (left) / "Thorough Analysis" (right)
- Current value displayed with units: "60 seconds"
- Recommended range indicator: subtle shading on 30–120s zone
- Save behavior: persist on change-end (onValueCommit) via existing `POST /api/settings/runtime`

### 2. Global Max Turns Slider

Add a new slider control in the same section for global max turns.

- New setting key: `runtime.maxTurns` (add to settings constants)
- Range: 1–50 turns, step 1, default 10
- Labels: "Quick Execution" (left) / "Extended Reasoning" (right)
- Current value displayed with units: "10 turns"
- Recommended range indicator: subtle shading on 5–20 zone
- API: extend `POST /api/settings/runtime` to accept `maxTurns` alongside existing `sdkTimeoutSeconds`
- Profile-level `maxTurns` overrides global default when set

### 3. Contextual Guidance

- Hover tooltip on each slider explaining tradeoff implications
- Timeout: "Lower values return faster but may cut off complex reasoning. Higher values allow thorough analysis but increase wait time."
- Turns: "Fewer turns limit agent actions for simple tasks. More turns allow extended multi-step reasoning."

### Existing Patterns to Reuse

- Slider component: `@/components/ui/slider` (shadcn)
- Save-on-blur pattern: `runtime-timeout-section.tsx` already does this via `handleSave` on blur
- Settings API: `POST /api/settings/runtime` + `GET /api/settings/runtime`
- FormSectionCard wrapper: already imported in the section component
- Toast feedback: already wired via `sonner`

## Key Files

| File | Purpose |
|------|---------|
| `src/components/settings/runtime-timeout-section.tsx` | Replace Input with Slider, add Max Turns slider |
| `src/app/api/settings/runtime/route.ts` | Extend POST/GET to handle `maxTurns` |
| `src/components/ui/slider.tsx` | Existing shadcn slider component |
| `src/lib/agents/claude-agent.ts` | Consumer — reads timeout from settings |
| `src/lib/validators/profile.ts` | Reference — profile-level `maxTurns` field |

## Acceptance Criteria

- [ ] SDK Timeout rendered as a slider (10–300s, step 5, default 60s)
- [ ] Global Max Turns rendered as a slider (1–50, step 1, default 10)
- [ ] Current value displayed next to each slider with units ("60 seconds", "10 turns")
- [ ] Descriptive labels at slider ends (speed vs quality)
- [ ] Hover tooltip explains tradeoff implications for each control
- [ ] Recommended range visual indicator (shaded zone) on each slider
- [ ] Changes persist via settings API on value commit
- [ ] Profile-level maxTurns overrides global default when set
- [ ] Mobile-friendly slider interaction (touch targets)

## Scope Boundaries

**Included:**
- SDK Timeout slider upgrade (from number input)
- Global Max Turns slider (new setting)
- Contextual labels and tooltips
- Recommended range indicator
- API extension for maxTurns

**Excluded:**
- Per-task timeout/turns override (separate per-task settings)
- Provider-specific timeout tuning (same timeout for all providers)
- Animated transitions between values
- A/B testing of recommended ranges
- Settings presets ("Quick", "Balanced", "Thorough")

## References

- Source: `kitchen-sink-03-23.md` — Issue #2 (Configurable Max Turns & Timeout Sliders)
- Pattern: `budget-guardrails-section.tsx` — slider with percentage display
- Related: `tool-permission-persistence` — settings table infrastructure
- Related: `cost-and-usage-dashboard` — settings consumption patterns
