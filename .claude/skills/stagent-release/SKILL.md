---
name: stagent-release
description: Build and publish the Stagent macOS desktop release locally. Use whenever the user asks to build the Stagent DMG, publish or refresh the desktop GitHub release, keep the website download link stable, or troubleshoot the local desktop release packaging flow.
---

# Stagent Release

This skill is only for the Stagent desktop release flow in this repository.

## Read First

- Read `scripts/release-desktop.mjs` before changing the release flow.
- Read `package.json` and `src-tauri/tauri.conf.json` if the build or bundle output looks wrong.
- Read the `Desktop Release Checklist` section in `README.md` before changing release docs.

## Architecture Overview

Stagent Desktop is a **Tauri v2 shell wrapping a Node CLI sidecar** (not a static export).

**Boot flow:** Rust reserves a localhost port → spawns `dist/cli.js` via resolved Node binary → CLI runs DB migrations + `next start` → Rust polls localhost → `WebviewWindow::navigate()` hands off to the live app.

**Build flow:** `scripts/tauri.mjs` runs `build:cli` → `next build` → `cargo tauri build` → post-bundle fixups (`.next/node_modules` sync, artifact pruning) → `scripts/release-desktop.mjs` signs, packages DMG, and uploads.

**Key files:** `src-tauri/src/main.rs` (Rust shell), `bin/cli.ts` (Node CLI), `scripts/tauri.mjs` (build orchestrator), `scripts/release-desktop.mjs` (release packager).

**Logs:** `/tmp/stagent-boot.log` (boot phases), `/tmp/stagent-sidecar.log` (CLI stdout/stderr), `/tmp/stagent-crash.log` (Rust panics).

## Workflow

1. Work on macOS only. The release script depends on `ditto` and `hdiutil`.
2. Build and publish with `npm run desktop:release`.
3. For a local packaging check without touching GitHub, run `npm run desktop:release -- --skip-upload`.
4. The normalized release artifacts are written to `output/release/Stagent.dmg` and `output/release/Stagent.app.zip`.
5. Published releases require `APPLE_SIGNING_IDENTITY` and notarization credentials. Prefer `APPLE_NOTARY_PROFILE` backed by `xcrun notarytool store-credentials`; direct `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` is also supported.
6. `--skip-upload` is the only supported path for ad-hoc local smoke builds without Apple credentials.
7. The published release must upload `Stagent.dmg` without a version in the filename so the stable download URL stays:
   `https://github.com/manavsehgal/stagent/releases/latest/download/Stagent.dmg`
8. Keep `public/desktop-icon-512.png` as the dedicated rounded desktop source icon with transparent corners. `public/icon-512.png` remains the square web/PWA icon.
9. Preserve DMG volume branding: the mounted image should include `.VolumeIcon.icns` and the volume must carry the Finder custom-icon flag.

## Release Rules

- Do not reintroduce a GitHub Actions workflow that builds the desktop release.
- Keep the uploaded DMG filename exactly `Stagent.dmg`.
- Prefer the default tag `desktop-v<package.json version>` unless the user explicitly asks for a different tag.
- Do not upload a release unless the app and DMG have been signed, notarized, and stapled.
- If the release process changes, update both this skill and the README release section in the same change.

## Known Issues & Fixes

Nine issues were solved across the desktop release pipeline. Reference these when diagnosing regressions.

### 1. DMG "damaged" error
**Symptom:** Gatekeeper rejects downloaded DMG as damaged.
**Cause:** Tauri only signs the Rust binary, not the full `.app` bundle. Quarantine triggers strict checks.
**Fix:** `codesign --force --deep --sign -` before DMG packaging (`signAppBundle()` in `release-desktop.mjs`).

### 2. Finder launch crash (SIGABRT)
**Symptom:** App crashes from Finder but works from terminal.
**Cause:** GUI apps get minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) — Node not found.
**Fix:** `resolve_node_bin()` in `main.rs` probes `/usr/local/bin/node`, `/opt/homebrew/bin/node`, nvm/fnm/volta paths.

### 3. `_up_/` resource paths
**Symptom:** `resolve_app_root()` can't find `dist/cli.js` in bundle.
**Cause:** Tauri rewrites `../` to `_up_/` inside `Contents/Resources/`.
**Fix:** `resolve_app_root()` checks `resource_dir/_up_/` first, then `resource_dir/`.

### 4. `#!/usr/bin/env node` fails from Finder
**Symptom:** `env: node: No such file or directory` when CLI spawns `next`.
**Cause:** Same minimal PATH issue as #2, but one layer deeper in shell shims.
**Fix:** Rust prepends node's directory to `PATH` before spawning the CLI child process.

### 5. `.bin/next` symlink broken
**Symptom:** `Cannot find module '../server/require-hook'` from `.bin/next`.
**Cause:** Tauri flattens symlinks to file copies — relative requires inside `.bin/` resolve to wrong paths.
**Fix:** CLI resolves `node_modules/next/dist/bin/next` directly, spawns via `process.execPath`.

### 6. `.next/node_modules` missing from bundle
**Symptom:** `Failed to load external module better-sqlite3-<hash>` at startup.
**Cause:** `next build` generates alias symlinks under `.next/node_modules/`; Tauri doesn't preserve them.
**Fix:** `scripts/tauri.mjs` copies `.next/node_modules` into the finished app with `verbatimSymlinks: true`.

### 7. Port drift
**Symptom:** Boot screen stuck waiting, but sidecar is healthy on a different port.
**Cause:** CLI re-scanned for available ports instead of using the port Rust assigned.
**Fix:** `bin/cli.ts` treats explicit `--port` as authoritative — no re-scan.

### 8. Bundle bloat
**Symptom:** DMG jumps to >500MB after production build lands.
**Cause:** `.next/dev` (~751MB) and other build artifacts bundled verbatim.
**Fix:** `scripts/tauri.mjs` prunes `.next/{dev,cache,diagnostics,trace*,turbopack,types}` post-bundle.

### 9. Boot screen hang after sidecar ready
**Symptom:** Boot screen stays visible even though sidecar is healthy.
**Cause:** JS-only `window.location.replace()` handoff races or misses on mounted-DMG launches.
**Fix:** Rust owns `WebviewWindow::navigate()` after `wait_for_server()` succeeds. JS is presentation-only.

## Troubleshooting Guide

| Symptom | Check |
|---------|-------|
| Boot screen stuck | `/tmp/stagent-boot.log` — find last phase. Missing `sidecar_ready`? Check sidecar log |
| Sidecar crash | `/tmp/stagent-sidecar.log` and `/tmp/stagent-crash.log` |
| Module not found | Verify `.next/node_modules` sync ran in `scripts/tauri.mjs` |
| Port conflict | Check for IPv6 listeners: `lsof -i :3210` — both IPv4 and IPv6 |
| DMG damaged | Verify `signAppBundle()` ran before DMG packaging |
| Bundle >500MB | Verify prune step ran — check for `.next/dev` in app bundle |
| `env: node` error | Check `resolve_node_bin()` covers the target machine's node path |
| Handoff not navigating | Confirm `main.rs` calls `WebviewWindow::navigate()` — JS must NOT own navigation |

## Verification

- Confirm the release script finishes with a successful `hdiutil verify`.
- For a published release, confirm the script reports `Notarized: yes`.
- If you published the release, verify the asset names on GitHub with `gh release view <tag> --json assets,url`.
- If the user asks about the website download link, point it to the stable asset URL, not the generic releases page.
- **Local smoke:** `npm run desktop:release -- --skip-upload` runs the full flow without GitHub upload.
- **Sidecar smoke:** integrated into `npm run desktop:build` — launches `dist/cli.js` under Finder-style minimal PATH and checks HTTP 200.
- **DMG smoke:** integrated into `npm run desktop:release` — mounts DMG, launches app, checks boot log phases through `handoff_navigated`.
- **Manual DMG test:** mount the DMG, drag to `/Applications`, launch from Finder, confirm workspace loads within 15s.
