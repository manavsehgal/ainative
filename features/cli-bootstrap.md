---
title: Desktop Sidecar Bootstrap
status: completed
priority: P0
milestone: mvp
source: ideas/tech-stack-ainative.md, ideas/npx-web-app.md
dependencies: []
---

# Desktop Sidecar Bootstrap

## Description

The internal sidecar bootstrap that powers the desktop app. This is the runtime bridge between the Tauri shell and the localhost-hosted Next.js application — a thin Commander-based helper that bootstraps the full app with zero manual server setup.

The sidecar handles the complete startup sequence: creating the `~/.ainative/` data directory, running database migrations, finding an available port, working around dependency hoisting, spawning the Next.js dev server with Turbopack, and handling graceful shutdown by forwarding signals to the child process.

This feature is no longer a user-facing distribution path. It is still critical because every desktop launch depends on it being robust, idempotent, and fast.

## User Story

As a desktop user, I want the ainative app shell to boot its local sidecar automatically so that the native app opens into a working workspace without a separate server startup step.

## Technical Approach

- **CLI framework**: Commander for argument parsing (`--port`, `--reset`, `--version`, `--help`)
- **Build tool**: tsup to bundle `bin/cli.ts` → `dist/cli.js` as a single ESM file with shebang
- **Data directory**: `~/.ainative/` with subdirectories for `logs/` and `sessions/`, created with `mkdirSync({ recursive: true })`
- **Database init**: Open SQLite with better-sqlite3, enable WAL mode and foreign keys, run Drizzle migrations, then close the connection (CLI only bootstraps — the app opens its own connection)
- **Port allocation**: Try port 3000, increment on conflict using `net.createServer()` probe
- **Dependency hoisting workaround**: Detect if `next` is missing from local `node_modules/`, walk up the tree to find hoisted root, copy `src/`, `public/`, and config files there
- **Process management**: Spawn `next dev --turbopack` as a child process with `stdio: "inherit"`, pass `AINATIVE_DATA_DIR` and `PORT` as env vars
- **Browser-open suppression**: The desktop wrapper launches the sidecar with `--no-open`, while local development can still use the direct browser path if needed
- **Shutdown**: Forward SIGINT/SIGTERM to child process, exit with child's exit code

### package.json configuration

```json
{
  "name": "ainative",
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build:cli": "tsup"
  }
}
```

## Acceptance Criteria

- [ ] The desktop sidecar launches the dev server, runs migrations, and serves the app without requiring a separate manual server start
- [ ] `dist/cli.js --port 8080` starts on the specified port for local development and desktop wrapper integration
- [ ] `dist/cli.js --reset` deletes the database and reinitializes
- [ ] `dist/cli.js --help` shows usage information including data directory location
- [ ] `dist/cli.js --version` shows the package version
- [ ] The sidecar handles dependency hoisting correctly (Turbopack resolves all imports)
- [ ] Ctrl+C gracefully stops both the CLI and the Next.js process
- [ ] Startup is idempotent — running twice causes no errors or data corruption
- [ ] `dist/cli.js` is a single ESM file under 100 KB with proper shebang

## Scope Boundaries

**Included:**
- internal sidecar entry point with Commander
- tsup build configuration
- Data directory creation
- Database migration runner (bootstrap only)
- Port allocation
- dependency hoisting workaround
- Process spawning and signal forwarding
- sidecar-friendly no-open launch path
- package.json build scripts for the internal helper

**Excluded:**
- The Next.js application itself (see `app-shell`)
- Database schema definition (see `database-schema`)
- Production build mode (`--production` flag deferred to post-MVP)
- end-user distribution concerns beyond the internal sidecar bootstrap

## References

- Source: `ideas/tech-stack-ainative.md` — CLI Entry Point section
- Related features: `database-schema` (provides migration files), `app-shell` (the Next.js app this CLI spawns)
