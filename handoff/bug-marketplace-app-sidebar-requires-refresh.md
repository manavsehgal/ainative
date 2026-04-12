---
title: "Bug: Marketplace App Sidebar Requires Page Refresh"
audience: stagent-base
status: proposed
source_branch: local
handoff_reason: When marketplace apps are installed, the sidebar menu entry only appears after a full page refresh — it does not reactively update.
---

# Bug: Marketplace App Sidebar Requires Page Refresh

## Summary

When a marketplace app is installed, its sidebar menu entry does **not** appear until the user manually refreshes the Stagent app (full page reload). The sidebar should reactively update immediately after installation completes, without requiring a refresh.

## Reproduction

1. Open Stagent app — note the sidebar entries (e.g., Wealth, Growth)
2. Install a new marketplace app (e.g., via `installApp()` or the marketplace UI)
3. Installation completes successfully
4. **Expected:** New app immediately appears in the sidebar
5. **Actual:** Sidebar remains unchanged. App only appears after a full page refresh (Cmd+R / F5)

## Root Cause (Likely)

The sidebar component likely fetches the list of installed apps on mount (or via an initial API call) but does **not** re-fetch or subscribe to changes when a new `app_instances` record is inserted. Possible causes:

- The sidebar query is not reactive / not using a subscription or invalidation pattern
- The `installApp()` flow does not emit an event or invalidate the sidebar cache
- If using SWR/React Query, the `app_instances` query key is not being invalidated after install

## Proposed Fix

After `installApp()` succeeds, one of:

1. **Invalidate the sidebar query** — If using React Query / SWR, call `mutate()` or `invalidateQueries()` on the sidebar's app list query key
2. **Emit a reactive event** — Have `installApp()` emit an event (e.g., via a store, EventEmitter, or WebSocket) that the sidebar subscribes to
3. **Optimistic update** — Immediately add the new app to the sidebar's local state while the DB write completes in the background

## Impact

- Affects all marketplace app installations
- Users may think the install failed because nothing visually changes
- Minor UX friction — the app is installed correctly, just not reflected in the UI until refresh
