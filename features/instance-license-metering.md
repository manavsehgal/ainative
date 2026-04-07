---
title: Hybrid Instance License Metering
status: planned
priority: P2
milestone: post-mvp
source: features/architect-report.md
dependencies: [instance-bootstrap, local-license-manager, license-activation-flow]
---

# Hybrid Instance License Metering

## Description

When a user runs multiple stagent clones on the same machine (e.g., domain-focused private instances for wealth management, investor relations, growth/sales), we need a licensing model that doesn't punish the legitimate power user but also doesn't allow unlimited sharing of a single paid seat. This feature implements a **hybrid metering model**: local tier features work in any number of clones without gating, while cloud-side features (cloud sync, marketplace, telemetry) meter seats per paid tier using a stable `(email, machineFingerprint, instanceId)` tuple.

The rationale is architectural and commercial. Architecturally, the license row is already per-`STAGENT_DATA_DIR`, so local gating is a no-op — every clone already reads its own row. Commercially, strict per-instance activation would create friction exactly where power users want freedom, while unlimited replication has no upsell path. Hybrid is the middle ground: local replication is free, cloud integrations are metered.

This feature extends `LicenseManager` to send the `(email, machineFingerprint, instanceId)` tuple during cloud validation. Supabase edge function work (seat counting, grace periods, upsell CTAs) is acknowledged as a separate workstream and is **not** in this feature's scope — the client-side code is designed so the server can be built later without client changes.

## User Story

As a paying stagent user on the Scale tier running three domain-focused private instances on my Mac, I want all three instances to work fully with local features (tasks, workflows, documents, agents) without any gating, and I want the cloud features I'm paying for (sync, marketplace) to recognize all three as legitimate uses of my single paid seat, so that I get the full power of stagent for my personal use without needing to buy three seats.

## Technical Approach

**Machine fingerprint generator** (from `instance-bootstrap`): reused here. Returns a stable per-machine identifier computed from `os.hostname()`, `os.userInfo().username`, and a SHA-256 hash of the primary network interface MAC address. Not personally identifying — does not include email, name, or arbitrary personal data. Computed once per boot and cached in memory.

**`LicenseManager.validateAndRefresh` enhancement:**

- Before calling `validateLicenseWithCloud(email)`, construct the full tuple: `{email, machineFingerprint: getMachineFingerprint(), instanceId: getInstanceId()}`
- Pass the tuple through to `validateLicenseWithCloud` (extend its signature)
- Cloud response may include a new field `seatStatus: "ok" | "over_limit" | "grace"` alongside existing `valid` / `tier` / `expiresAt`
- If `seatStatus === "over_limit"`: keep local tier unchanged (local features never gate), but store `settings.license.seatStatus = "over_limit"` for UI surfacing
- If `seatStatus === "grace"`: enter existing 7-day grace period behavior
- If cloud call fails entirely: fall through to existing grace period logic — no change

**TIER_LIMITS extension** (`src/lib/license/tier-limits.ts`):

- Add a new limit key `maxCloudInstances` to the `LimitResource` type
- Values: `community: 1`, `solo: 2`, `operator: 5`, `scale: Number.POSITIVE_INFINITY`
- This limit is **advisory** client-side — the actual enforcement happens at Supabase. Clients use the value only for UI hints ("You have 3 of 5 instances — upgrade to Scale for unlimited").

**Cloud validation payload change** (`src/lib/license/cloud-validation.ts`):

- Extend `validateLicenseWithCloud` to accept `{email, machineFingerprint, instanceId}` instead of just `email`
- Send as a JSON body field alongside email (backward compatible — server can ignore unknown fields)
- Parse optional `seatStatus` from response

**Local UI surfacing (minimal — detailed design deferred to Settings feature):**

- `settings.license.seatStatus` read by the Settings → License section
- If `over_limit`: show a soft banner "You have more instances than your tier allows. Upgrade to Scale for unlimited instances." with a link to the existing `upgrade-cta-banners` feature
- If `grace`: existing grace-period UI applies

**No DB schema changes.** `seatStatus` fits in the existing `settings` key-value store.

**Testing:**

- Unit test: machine fingerprint is stable across multiple calls in the same session
- Unit test: `validateAndRefresh` with `STAGENT_CLOUD_DISABLED=true` does not call cloud (preserves existing behavior)
- Unit test: cloud response with `seatStatus="over_limit"` does not downgrade tier locally
- Unit test: cloud response missing `seatStatus` (old server version) is handled gracefully
- Integration test: activating a second instance on the same machine with a stub cloud server returns the same tier and correct `seatStatus`

**Explicitly out of scope for this feature (flagged for future work):**

- The Supabase edge function that actually counts seats
- Seat-usage dashboard showing all active instances for an email
- Cloud-driven instance revocation (forcing a specific instanceId to downgrade)
- Machine fingerprint collision handling (stale instanceIds across re-clones)

## Acceptance Criteria

- [ ] `getMachineFingerprint()` exported from `src/lib/instance/fingerprint.ts` returns a stable SHA-256 hex string across multiple calls in the same process
- [ ] Fingerprint does not include email, username, or personally identifying strings beyond the hashed MAC
- [ ] `validateLicenseWithCloud` accepts the new `{email, machineFingerprint, instanceId}` payload
- [ ] `LicenseManager.validateAndRefresh` constructs the tuple and passes it to cloud validation
- [ ] `LicenseManager.validateAndRefresh` with `STAGENT_CLOUD_DISABLED=true` continues to skip cloud entirely (backward compat)
- [ ] Cloud response with `seatStatus="over_limit"` is stored in `settings.license.seatStatus` without changing local tier
- [ ] Cloud response missing `seatStatus` field is handled as if status were `"ok"` (graceful degradation against old server versions)
- [ ] `TIER_LIMITS` has new `maxCloudInstances` key with values `community:1, solo:2, operator:5, scale:Infinity`
- [ ] Settings → License section reads `settings.license.seatStatus` and shows "over limit" banner when applicable
- [ ] Unit tests cover fingerprint stability, cloud-disabled short-circuit, over-limit handling, and old-server graceful degradation
- [ ] No changes to existing `license` table schema; no migration required
- [ ] No breaking changes to `LicenseManager` public API — all existing callers continue to work unchanged

## Scope Boundaries

**Included:**
- Machine fingerprint generator in `src/lib/instance/fingerprint.ts` (stub delivered in `instance-bootstrap`, full implementation here)
- Extended `validateLicenseWithCloud` payload shape
- `LicenseManager.validateAndRefresh` enhancement to include fingerprint + instanceId
- `TIER_LIMITS` new `maxCloudInstances` key
- Local over-limit banner surfacing via existing settings UI
- Unit tests covering fingerprint + metering logic

**Excluded:**
- Supabase edge function implementation for seat counting — separate workstream, server-side
- Seat usage dashboard (which instances are active, when each was last seen)
- Revocation flow (cloud forcing a specific instanceId to downgrade)
- Machine fingerprint collision resolution for users re-cloning frequently
- Billing integration for "buy another seat" flow — handled by existing `upgrade-cta-banners` feature
- Email verification or fingerprint attestation
- Offline-first seat counting (would require local ledger sync)
- Gating any local feature on seat status — local features are always unlimited by design

## References

- Source: `features/architect-report.md` — "Polling & License Metering" section and proposed TDR-030
- Related features: depends on `instance-bootstrap` (machine fingerprint stub, instanceId), `local-license-manager` (LicenseManager module), `license-activation-flow` (activation pipeline). Coordinates with `upgrade-cta-banners` for upsell UI.
- Design patterns: TDR-030 (proposed) — hybrid instance licensing; TDR-011 (JSON-in-TEXT for settings storage)
- Memory: `memory/sdk-subprocess-env-isolation.md` — reminder that API key handling is already isolated, so fingerprint work does not affect OAuth mode
- Rationale: architect report "Hybrid License Model" section
