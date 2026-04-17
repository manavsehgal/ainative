# Stagent — About Page Reference

Captured from: https://stagent.io/about/
Date: 2026-04-17
Files: 1 | ~2KB total

This folder is the **canonical source** for the `## About Author` section in `README.md`. The README block between `<!-- ABOUT:BEGIN source=https://stagent.io/about/ -->` and `<!-- ABOUT:END -->` is kept in sync with [about.md](about.md) by:

- `refresh-content-pipeline` Stage 4 — re-captures the source and auto-edits between markers on drift
- `doc-generator` Phase 7 — splices this content into every regenerated README

Update protocol:

1. Re-run `/capture https://stagent.io/about/` (or rely on `/refresh-content-pipeline` to do it).
2. Confirm [about.md](about.md) matches the live page.
3. Let Stage 4 / Phase 7 propagate changes into `README.md` — do not hand-edit the ABOUT marker block.

Internal rename: `### Why Stagent` on the source page is rendered as `### Research Premise` in `README.md` to avoid colliding with the existing top-level `## Why Stagent` heading.
