# Reading Radar

A reference bundle that turns what you read this week into one takeaway digest.

## What's in the bundle

| Primitive | Purpose |
|---|---|
| Profile `reader-coach` | Asks for the **one** takeaway per reading — no exhaustive summaries |
| Blueprint `weekly-synthesis` | 3-step sequence: cluster → motifs → email digest |
| Table `readings` | url, title, takeaway, tags, rating, week — one row per reading |
| Schedule `sunday-synth` | Fires Sundays 9am local, runs the blueprint |

## How it composes

1. You log readings throughout the week (chat tool, `readings` table UI, or directly in SQL).
2. Sunday at 9am, `sunday-synth` fires `weekly-synthesis` for the current ISO week.
3. The blueprint clusters takeaways into themes, pulls the motifs, and drafts a short email digest.

## Getting started after install

1. Navigate to `/tables` → `readings` and log 2–3 readings with one takeaway each.
2. Navigate to `/schedules` → `reading-radar:sunday-synth` and click **Run now** to fire ad-hoc.
3. Task output appears in `/tasks`.

## Why it exists

This bundle is the second dogfood primitive-bundle (after `finance-pack`). It exercises the full
Self-Extending Machine load path (M1 bundle loader, M2 schedules-as-YAML, M4 app materialization)
in a non-financial domain to surface any domain-specific coupling.
