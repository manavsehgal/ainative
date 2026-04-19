# Finance Pack

A starter plugin bundle that demonstrates the Kind 5 primitive-bundle pattern.

**What's inside:**
- `profiles/personal-cfo/` — agent profile that thinks like a personal CFO
- `blueprints/monthly-close.yaml` — three-step monthly close workflow
- `tables/transactions.yaml` — transactions ledger schema
- `schedules/monthly-close.yaml` — monthly close schedule that fires on the 1st at 9am, running the personal-cfo profile

**To use:**
1. The bundle auto-installs at `~/.ainative/plugins/finance-pack/` on first boot.
2. From chat, run `reload_plugins` to pick up edits.
3. Pick the "Transactions" template when creating a new table.
4. Spawn the "Monthly Close" workflow under Workflows.
