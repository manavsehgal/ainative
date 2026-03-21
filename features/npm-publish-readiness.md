---
title: NPM Publish Readiness
status: deferred
priority: P3
milestone: post-mvp
source: ideas/npx-web-app.md, features/cli-bootstrap.md
dependencies: [cli-bootstrap, database-schema, app-shell]
---

# NPM Publish Readiness

## Description

This feature is no longer on the active product path. Stagent is now positioned as a desktop application, so npm publication is treated as legacy work rather than the live distribution channel.

The existing npm hardening work remains useful as historical context for the internal sidecar bootstrap, but the repository no longer treats a public npm package as a user-facing requirement.

## User Story

As a maintainer, I want prior npm-distribution work documented as superseded so the product docs stop presenting registry install as the intended way to get Stagent.

## Technical Approach

- Remove public npm install and publish instructions from user-facing documentation
- Remove npm publish-only config from `package.json`
- Keep the internal sidecar build path (`build:cli`) because the desktop wrapper still depends on `dist/cli.js`
- Route distribution documentation and release automation toward GitHub-hosted desktop artifacts instead

## Acceptance Criteria

- [ ] README no longer presents npm or `npx` as a user distribution path
- [ ] `package.json` no longer includes public npm publish wiring such as `bin` or `prepublishOnly`
- [ ] The desktop build and GitHub release path are the only repo-documented end-user install channel

## Verification

- README quick-start review
- package.json config review
- desktop release workflow review

## Scope Boundaries

**Included:**
- documenting the deprecation of npm distribution
- removing npm publish-specific repo wiring
- preserving only the internal sidecar build steps needed by the desktop app

**Excluded:**
- restoring npm publication as an end-user channel
- Homebrew, App Store, or other future desktop channels
- runtime or provider feature work unrelated to the distribution reset

## References

- Related feature: `features/cli-bootstrap.md`
- Related feature: `features/tauri-desktop.md`
