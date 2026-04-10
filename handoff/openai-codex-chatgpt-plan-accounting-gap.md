# OpenAI Codex ChatGPT Plan Accounting Gap

## Status

Partially implemented as of 2026-04-10.

OpenAI Codex App Server now supports ChatGPT auth in Settings and is correctly treated as a separate auth/billing mode from OpenAI Direct API usage. The remaining gap is in subscription cost accounting, not auth.

## What Works

- `openai-codex-app-server` is marked `billingMode: "subscription"` when ChatGPT auth is connected.
- `openai-direct` remains `billingMode: "usage"`.
- Settings > OpenAI shows dual-billing messaging when ChatGPT auth and `OPENAI_API_KEY` are both present.
- Settings > Cost & Usage Guardrails labels Codex as `Plan priced`.
- Manage > Cost & Usage labels Codex rows as `plan priced` and OpenAI Direct as usage-priced.

## Gap

OpenAI ChatGPT-backed Codex is only labeled as subscription-backed. It is not yet given a real subscription price basis the way Claude OAuth is.

Current behavior:

- Guardrails inject fixed monthly subscription cost only for `claude-code`.
- `openai-codex-app-server` usually shows `Plan priced` but `$0.00` current spend because no OpenAI subscription price is being applied.
- There is no OpenAI plan selector or OpenAI subscription price basis in Settings > Cost & Usage Guardrails.
- `/costs` and guardrail pacing do not yet distinguish ChatGPT plan cost from OpenAI API token usage beyond the label.

## Relevant Code

- [runtime-setup.ts](/Users/manavsehgal/Developer/stagent/src/lib/settings/runtime-setup.ts)
- [budget-guardrails.ts](/Users/manavsehgal/Developer/stagent/src/lib/settings/budget-guardrails.ts)
- [budget-guardrails-section.tsx](/Users/manavsehgal/Developer/stagent/src/components/settings/budget-guardrails-section.tsx)
- [cost-dashboard.tsx](/Users/manavsehgal/Developer/stagent/src/components/costs/cost-dashboard.tsx)
- [openai-chatgpt-auth-control.tsx](/Users/manavsehgal/Developer/stagent/src/components/settings/openai-chatgpt-auth-control.tsx)
- [openai-codex-auth.ts](/Users/manavsehgal/Developer/stagent/src/lib/agents/runtime/openai-codex-auth.ts)

## Implementation Notes

- Claude subscription pricing is special-cased in [budget-guardrails.ts](/Users/manavsehgal/Developer/stagent/src/lib/settings/budget-guardrails.ts) around the `claude-code` runtime only.
- OpenAI currently has no equivalent `chatgpt plan -> monthly USD basis` path.
- ChatGPT plan metadata is available from the Codex auth session and currently resolves to `prolite` for this account, rendered in UI as `Pro`.

## Recommended Follow-Up

1. Add an OpenAI ChatGPT subscription pricing source.
2. Extend guardrails so `openai-codex-app-server` injects monthly/daily subscription cost the same way `claude-code` does.
3. Decide whether OpenAI needs:
   - an explicit operator-selected plan basis, or
   - an inferred basis from the authenticated ChatGPT account plan.
4. Update `/costs` so subscription-backed Codex shows meaningful subscription cost basis rather than `$0.00`.
5. Add tests covering OpenAI subscription guardrail math and dashboard rendering.

## Suggested Acceptance Criteria

- ChatGPT-authenticated Codex has a non-zero monthly subscription basis in guardrails.
- OpenAI Direct remains pure usage-priced API billing.
- Dual billing remains explicit when both are configured.
- `/settings` and `/costs` show consistent pricing semantics for OpenAI subscription vs API usage.
