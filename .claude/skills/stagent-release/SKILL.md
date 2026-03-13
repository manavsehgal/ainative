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

## Workflow

1. Work on macOS only. The release script depends on `ditto` and `hdiutil`.
2. Build and publish with `npm run desktop:release`.
3. For a local packaging check without touching GitHub, run `npm run desktop:release -- --skip-upload`.
4. The normalized release artifacts are written to `output/release/Stagent.dmg` and `output/release/Stagent.app.zip`.
5. The published release must upload `Stagent.dmg` without a version in the filename so the stable download URL stays:
   `https://github.com/manavsehgal/stagent/releases/latest/download/Stagent.dmg`
6. Keep `public/desktop-icon-512.png` as the dedicated rounded desktop source icon with transparent corners. `public/icon-512.png` remains the square web/PWA icon.
7. Preserve DMG volume branding: the mounted image should include `.VolumeIcon.icns` and the volume must carry the Finder custom-icon flag.

## Release Rules

- Do not reintroduce a GitHub Actions workflow that builds the desktop release.
- Keep the uploaded DMG filename exactly `Stagent.dmg`.
- Prefer the default tag `desktop-v<package.json version>` unless the user explicitly asks for a different tag.
- If the release process changes, update both this skill and the README release section in the same change.

## Verification

- Confirm the release script finishes with a successful `hdiutil verify`.
- If you published the release, verify the asset names on GitHub with `gh release view <tag> --json assets,url`.
- If the user asks about the website download link, point it to the stable asset URL, not the generic releases page.
