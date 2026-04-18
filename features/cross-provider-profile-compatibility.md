---
title: Cross-Provider Profile Compatibility
status: completed
priority: P2
milestone: post-mvp
source: ideas/mvp-vision.md, features/agent-profile-catalog.md
dependencies: [provider-runtime-abstraction, openai-codex-app-server, agent-profile-catalog]
---

# Cross-Provider Profile Compatibility

## Description

ainative's current profile system is intentionally Claude-native. Profiles are discovered from `.claude/skills`, store Claude-oriented tool policy and MCP configuration, and inject `SKILL.md` content directly into Claude task prompts. That works well today, but it does not automatically translate into a safe or equivalent experience on Codex.

This feature makes profiles provider-aware without throwing away the current catalog. The goal is to preserve the value of reusable specialist profiles while explicitly modeling which runtimes each profile supports, which instructions/assets are provider-specific, and how the UI should behave when a user mixes an incompatible profile with a selected runtime.

## User Story

As a ainative user, I want profiles to declare which runtimes they support so that I can reuse specialist behavior across providers where appropriate and avoid silently broken combinations where profile packaging is provider-specific.

## Technical Approach

- Expand the profile model so a profile can declare compatibility by runtime, for example:
  - supported runtimes
  - provider-specific instruction payloads
  - provider-specific tool and MCP policy
  - optional fallback/default instructions shared across runtimes
- Keep the current Claude profile assets intact, but treat them as one runtime target rather than the universal source of truth.
- Update the profile registry so it can return provider compatibility metadata alongside the existing profile list.
- Update task creation, schedules, and workflow step editing so the selected runtime and profile are validated together:
  - compatible combinations are allowed
  - incompatible combinations are blocked or clearly warned before execution
- Make runtime resolution provider-aware. Execution should ask for the profile payload that matches the selected runtime instead of always injecting Claude `SKILL.md` content.
- Extend profile smoke tests so they can run against a specific runtime, or report `unsupported` clearly when a profile has no compatible payload for that provider.

## Acceptance Criteria

- [x] Profile metadata can declare supported runtimes and runtime-specific instruction/config payloads
- [x] Built-in profiles can express whether they support Claude, Codex, or both
- [x] Task, workflow-step, and schedule creation surfaces validate runtime/profile compatibility before execution
- [x] Runtime execution resolves provider-specific profile payloads instead of assuming Claude `SKILL.md` content
- [x] Profile testing can target a selected runtime and reports `unsupported` explicitly when no compatible profile payload exists
- [x] The profile browser/detail surface exposes compatibility information so operators can understand runtime coverage before choosing a profile

## Scope Boundaries

**Included:**
- Provider compatibility metadata
- Validation across tasks, workflows, and schedules
- Runtime-aware profile resolution and testing

**Excluded:**
- Automatic translation of Claude skill assets into Codex skill assets
- Community marketplace redesign
- Cross-provider quality scoring or profile benchmarking
- Migrating every existing profile to dual-provider support in this single slice

## References

- Depends on: [provider-runtime-abstraction](provider-runtime-abstraction.md), [openai-codex-app-server](openai-codex-app-server.md), [agent-profile-catalog](agent-profile-catalog.md)
- Related features: [multi-agent-routing](multi-agent-routing.md), [workflow-blueprints](workflow-blueprints.md)
- Related features: [sdk-runtime-hardening](sdk-runtime-hardening.md)

## Post-Completion Updates

- **SDK audit (2026-03-15)**: Removed decorative `temperature` field from all profile YAMLs and the `AgentProfile` type definition — the field had no effect on either Claude or Codex runtime behavior (F2). See [sdk-runtime-hardening](sdk-runtime-hardening.md)
