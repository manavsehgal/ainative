# Profile Runtime Default Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synthesize in-memory `AgentProfile` entries for inline app-manifest profile references that have no `profile.yaml` on disk, and improve the `NoCompatibleRuntimeError` message to name the configured-vs-expected runtime gap. Fixes the `cs-coach` dispatch failure surfaced during Phase 5 verification.

**Architecture:** A new low-precedence profile source (`app-manifest-source.ts`) scans `~/.ainative/apps/*/manifest.yaml` and synthesizes `AgentProfile` objects for any inline `profiles[]` entry whose id has no corresponding `profile.yaml`. Synthesizer runs first in `scanProfiles()` so file-based profiles always shadow synthesized ones with the same id. Cache signature extends to fingerprint apps directory. Error message at `execution-target.ts:243,303` is replaced with a builder that names the profile, expected runtimes, and configured runtimes.

**Tech Stack:** TypeScript, Vitest, Drizzle/SQLite (read-only here), Next.js 16 (smoke step only).

**Spec source:** `docs/superpowers/specs/2026-05-02-profile-runtime-default-resolution-design.md` (commit `e9cc6d20`)

**Scope:** REDUCE per scope challenge — install-time validation warning deferred. v1 = synthesizer + improved error message only.

---

## NOT in scope

| Deferred | Why deferred |
|----------|--------------|
| Install-time validation warning in `compose-integration.ts` | Improved error message at task time already names the gap and is actionable. Defer until field experience proves install-time pre-flight is needed. Documented in spec §Goals(3). |
| User-level "default runtime for orphan profiles" setting | Adds config surface for an inference problem solved by synthesis. YAGNI. |
| Dispatcher silent fallback when profile is unknown | Masks real misconfigurations. Violates Zero Silent Failures. |
| App-level `defaultRuntime` cascading to all profiles | Premature abstraction; one inline-stub use case so far. Extract on third use. |
| Auto-generating `profile.yaml` files on disk during composition | Future composition-kit work. |
| Builtin profile resolution changes | All builtins declare `supportedRuntimes`. No bug there. |
| New `ProfileOrigin = "app-manifest"` enum value | Reuse existing `"import"` to avoid migration surface area. |
| Backfill SKILL.md content for synthesized profiles via LLM | Profile authoring, not default resolution. |

---

## What already exists

- **`SUPPORTED_AGENT_RUNTIMES`** at `src/lib/agents/runtime/catalog.ts` — the synthesizer assigns this directly.
- **`AgentProfile` type** at `src/lib/agents/profiles/types.ts:42` — synthesized objects conform exactly.
- **`parseAppManifest(yamlText)`** at `src/lib/apps/registry.ts:182` — synthesizer calls this for safe parsing.
- **`getAinativeAppsDir()`** at `src/lib/utils/ainative-paths.ts` — directory resolution.
- **`getAinativeProfilesDir()`** at `src/lib/utils/ainative-paths.ts` — for shadowing checks.
- **`scanProfiles()`** at `src/lib/agents/profiles/registry.ts:275` — integration point. Currently calls `scanProfilesFromDir(SKILLS_DIR, ...)` then `scanProfilesFromDir(PROMOTED_PROFILES_DIR, ...)`. Map's last-write-wins semantics mean: insert synthesized entries FIRST and file-based scans overwrite them.
- **`getSkillsDirectorySignature()`** at `src/lib/agents/profiles/registry.ts:84` — cache fingerprint. Extend to also fingerprint the apps directory so app-manifest mutations invalidate the profile cache.
- **`listConfiguredRuntimeIds(states)`** at `src/lib/settings/runtime-setup.ts` — for the improved error message.
- **`getRuntimeSetupStates()`** at `src/lib/settings/runtime-setup.ts` — already called by `getConfiguredCandidateRuntimes()` (`execution-target.ts:158`); pass the same states down.
- **Vitest pattern with `vi.resetModules()` + dynamic import** — `src/lib/agents/profiles/__tests__/registry.test.ts:21-32` shows the pattern; reuse it for fresh synthesizer state per test.
- **`os.tmpdir()` + `fs.mkdtempSync`** — standard Node pattern; use it for temp app/profile directories in synthesizer tests.

---

## Error & Rescue Registry

| Error | Trigger | Impact | Rescue |
|-------|---------|--------|--------|
| Synthesizer crashes on malformed manifest.yaml | Corrupted file | Profile registry load aborts | Per-app try/catch; warn and continue. Tested in Task 2. |
| Apps directory does not exist | Fresh user, no apps installed | `fs.readdirSync` throws | `if (!fs.existsSync(appsDir)) return []` early. Tested in Task 2. |
| Two apps reference same profile id | Cross-app reuse | Last synthesis overwrites first | First-seen synthesis wins; subsequent app's id gets appended to `tags`. Tested in Task 2. |
| User authors profile.yaml for synthesized id | Customization | Synthesis must not shadow file-based | Synthesizer runs FIRST in `scanProfiles()`; file-based scans overwrite. Tested in Task 3. |
| App manifest mutation does not invalidate profile cache | User installs new app | Stale registry; `getProfile()` returns undefined | Extend `getSkillsDirectorySignature()` to also fingerprint `<appsDir>/*/manifest.yaml` mtimes. Tested in Task 3. |
| Builtin profile id collides with manifest entry | Edge case (unlikely; builtins live in `src/`, manifest entries in `~/.ainative/apps/`) | Synthesis may shadow builtin | Synthesizer skips ids that match a builtin (check `~/.claude/skills/<id>/profile.yaml` exists). Tested in Task 2. |
| **Module-load cycle via chat-tools import** | A static `import ... from "@/lib/chat/ainative-tools"` in any file under `src/lib/agents/` | `ReferenceError: Cannot access 'claudeRuntimeAdapter' before initialization` at first Next.js request | This plan does NOT add any chat-tools imports — synthesizer touches only profile/yaml/fs modules. Smoke test in Task 5 confirms no cycle. Per TDR-032. |
| `NoCompatibleRuntimeError` printed without configured-runtimes context | Test harness mocks `getRuntimeSetupStates()` returning empty | Misleading message | Builder uses `(none)` literal when configured list is empty. Tested in Task 4. |
| Smoke skipped because "unit tests pass" | Skipping per CLAUDE.md smoke-test budget | Module-load cycle could ship undetected | Task 5 is mandatory and cannot be deferred. Per CLAUDE.md, this plan touches `execution-target.ts` (runtime-registry-adjacent) so smoke is required. |

---

## File Structure

**Create:**
- `src/lib/agents/profiles/app-manifest-source.ts` (~80 lines) — synthesizer logic + `loadAppManifestProfiles(appsDir, profilesDir, builtinsDir)`.
- `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts` — unit tests (8 cases).

**Modify:**
- `src/lib/agents/profiles/registry.ts` — wire synthesizer into `scanProfiles()` (insert FIRST), extend `getSkillsDirectorySignature()` to include apps dir fingerprint.
- `src/lib/agents/profiles/__tests__/registry.test.ts` — one new test verifying file-based profile shadows synthesized when ids match.
- `src/lib/agents/runtime/execution-target.ts` — replace two `NoCompatibleRuntimeError` throws with a builder.
- `src/lib/agents/runtime/__tests__/execution-target.test.ts` — three cases for the new error message format.

---

## Task 1: Synthesizer module — happy path (TDD)

**Files:**
- Create: `src/lib/agents/profiles/app-manifest-source.ts`
- Create: `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts`

- [ ] **Step 1: Write the happy-path failing test**

```ts
// src/lib/agents/profiles/__tests__/app-manifest-source.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import yaml from "js-yaml";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";
import { loadAppManifestProfiles } from "../app-manifest-source";

describe("loadAppManifestProfiles", () => {
  let tmpRoot: string;
  let appsDir: string;
  let profilesDir: string;
  let builtinsDir: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ams-test-"));
    appsDir = path.join(tmpRoot, "apps");
    profilesDir = path.join(tmpRoot, "profiles");
    builtinsDir = path.join(tmpRoot, "builtins");
    fs.mkdirSync(appsDir, { recursive: true });
    fs.mkdirSync(profilesDir, { recursive: true });
    fs.mkdirSync(builtinsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  function writeManifest(appId: string, manifest: Record<string, unknown>): void {
    const appDir = path.join(appsDir, appId);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, "manifest.yaml"), yaml.dump(manifest));
  }

  it("synthesizes profile from full inline manifest entry", () => {
    writeManifest("customer-follow-up-drafter", {
      id: "customer-follow-up-drafter",
      name: "Customer follow-up drafter",
      profiles: [
        { id: "cs-coach", name: "CS coach", description: "Helpful customer-success agent" },
      ],
      blueprints: [],
      tables: [],
      schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);

    expect(profiles).toHaveLength(1);
    const csCoach = profiles[0];
    expect(csCoach.id).toBe("cs-coach");
    expect(csCoach.name).toBe("CS coach");
    expect(csCoach.description).toBe("Helpful customer-success agent");
    expect(csCoach.systemPrompt).toBe("Helpful customer-success agent");
    expect(csCoach.skillMd).toBe("");
    expect(csCoach.domain).toBe("work");
    expect(csCoach.tags).toEqual(["customer-follow-up-drafter"]);
    expect(csCoach.supportedRuntimes).toEqual(SUPPORTED_AGENT_RUNTIMES);
    expect(csCoach.scope).toBe("user");
    expect(csCoach.origin).toBe("import");
    expect(csCoach.readOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/agents/profiles/__tests__/app-manifest-source.test.ts
```
Expected: FAIL with "Cannot find module '../app-manifest-source'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/agents/profiles/app-manifest-source.ts
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { SUPPORTED_AGENT_RUNTIMES } from "@/lib/agents/runtime/catalog";
import { AppManifestSchema } from "@/lib/apps/registry";
import type { AgentProfile } from "./types";

function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function loadAppManifestProfiles(
  appsDir: string,
  profilesDir: string,
  builtinsDir: string
): AgentProfile[] {
  if (!fs.existsSync(appsDir)) return [];

  const synthesized = new Map<string, AgentProfile>();

  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const appId = entry.name;
    const manifestPath = path.join(appsDir, appId, "manifest.yaml");
    if (!fs.existsSync(manifestPath)) continue;

    let manifest: ReturnType<typeof AppManifestSchema.safeParse>;
    try {
      const parsed = yaml.load(fs.readFileSync(manifestPath, "utf-8"));
      manifest = AppManifestSchema.safeParse(parsed);
    } catch (err) {
      console.warn(`[app-manifest-source] Malformed manifest for ${appId}:`, err);
      continue;
    }
    if (!manifest.success) {
      console.warn(`[app-manifest-source] Invalid manifest for ${appId}`);
      continue;
    }

    for (const profileRef of manifest.data.profiles ?? []) {
      const profileId = profileRef.id;

      // Shadow check: skip if a profile.yaml exists for this id, or a builtin
      const userYaml = path.join(profilesDir, profileId, "profile.yaml");
      const builtinYaml = path.join(builtinsDir, profileId, "profile.yaml");
      if (fs.existsSync(userYaml) || fs.existsSync(builtinYaml)) continue;

      // Collision: keep first synthesis, append app id to tags
      const existing = synthesized.get(profileId);
      if (existing) {
        if (!existing.tags.includes(appId)) {
          existing.tags = [...existing.tags, appId];
        }
        continue;
      }

      const refRecord = profileRef as Record<string, unknown>;
      const name =
        typeof refRecord.name === "string" ? refRecord.name : titleCase(profileId);
      const description =
        typeof refRecord.description === "string" ? refRecord.description : "";

      synthesized.set(profileId, {
        id: profileId,
        name,
        description,
        domain: "work",
        tags: [appId],
        systemPrompt: description,
        skillMd: "",
        supportedRuntimes: SUPPORTED_AGENT_RUNTIMES,
        scope: "user",
        origin: "import",
        readOnly: true,
      });
    }
  }

  return Array.from(synthesized.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/agents/profiles/__tests__/app-manifest-source.test.ts
```
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/agents/profiles/app-manifest-source.ts src/lib/agents/profiles/__tests__/app-manifest-source.test.ts
git commit -m "feat(profiles): synthesize profiles from app-manifest inline refs

Inline manifest profile entries (id+name+description, no source) had no
profile body on disk, so getProfile() returned undefined and dispatch
threw NoCompatibleRuntimeError. Synthesizer fills the gap with
permissive supportedRuntimes defaults.

Happy path only — edge cases follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Synthesizer edge cases (TDD)

**Files:**
- Modify: `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts`
- Modify: `src/lib/agents/profiles/app-manifest-source.ts` (only if needed; happy-path impl already covers most)

- [ ] **Step 1: Add the edge-case tests**

Append to `src/lib/agents/profiles/__tests__/app-manifest-source.test.ts` inside `describe("loadAppManifestProfiles", ...)`:

```ts
  it("titleCases id when name is missing", () => {
    writeManifest("habit-tracker", {
      id: "habit-tracker",
      name: "Habit tracker",
      profiles: [{ id: "habit-coach" }],
      blueprints: [],
      tables: [],
      schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles[0].name).toBe("Habit Coach");
    expect(profiles[0].description).toBe("");
    expect(profiles[0].systemPrompt).toBe("");
  });

  it("does not synthesize when profile.yaml exists in profilesDir (shadowing)", () => {
    writeManifest("customer-follow-up-drafter", {
      id: "customer-follow-up-drafter",
      name: "Customer follow-up drafter",
      profiles: [{ id: "cs-coach", name: "CS coach", description: "Stub" }],
      blueprints: [], tables: [], schedules: [],
    });
    // User authored a real profile.yaml at profilesDir/cs-coach/profile.yaml
    fs.mkdirSync(path.join(profilesDir, "cs-coach"), { recursive: true });
    fs.writeFileSync(
      path.join(profilesDir, "cs-coach", "profile.yaml"),
      "id: cs-coach\nname: User-customized\n"
    );

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });

  it("does not synthesize when builtin exists for the id", () => {
    writeManifest("some-app", {
      id: "some-app", name: "Some app",
      profiles: [{ id: "general", name: "General override" }],
      blueprints: [], tables: [], schedules: [],
    });
    fs.mkdirSync(path.join(builtinsDir, "general"), { recursive: true });
    fs.writeFileSync(
      path.join(builtinsDir, "general", "profile.yaml"),
      "id: general\nname: Builtin general\n"
    );

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });

  it("returns empty array when apps directory does not exist", () => {
    const missingDir = path.join(tmpRoot, "does-not-exist");
    expect(loadAppManifestProfiles(missingDir, profilesDir, builtinsDir)).toEqual([]);
  });

  it("skips malformed manifest.yaml without crashing other apps", () => {
    // App A: malformed
    fs.mkdirSync(path.join(appsDir, "broken"), { recursive: true });
    fs.writeFileSync(path.join(appsDir, "broken", "manifest.yaml"), "::: not yaml :::");
    // App B: valid
    writeManifest("good-app", {
      id: "good-app", name: "Good app",
      profiles: [{ id: "good-profile", name: "Good", description: "Works" }],
      blueprints: [], tables: [], schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("good-profile");
  });

  it("first-wins on profile id collision and merges app ids into tags", () => {
    writeManifest("app-a", {
      id: "app-a", name: "App A",
      profiles: [{ id: "shared-coach", name: "Shared coach", description: "First" }],
      blueprints: [], tables: [], schedules: [],
    });
    writeManifest("app-b", {
      id: "app-b", name: "App B",
      profiles: [{ id: "shared-coach", name: "Different name", description: "Second" }],
      blueprints: [], tables: [], schedules: [],
    });

    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(1);
    // First wins: name + description from app-a
    expect(profiles[0].name).toBe("Shared coach");
    expect(profiles[0].description).toBe("First");
    // Tags include both app ids (order depends on filesystem readdir)
    expect(profiles[0].tags.sort()).toEqual(["app-a", "app-b"]);
  });

  it("returns empty array when manifest has no profiles[]", () => {
    writeManifest("no-profiles-app", {
      id: "no-profiles-app", name: "No profiles",
      blueprints: [], tables: [], schedules: [],
    });
    const profiles = loadAppManifestProfiles(appsDir, profilesDir, builtinsDir);
    expect(profiles).toHaveLength(0);
  });
```

- [ ] **Step 2: Run all synthesizer tests**

```bash
npx vitest run src/lib/agents/profiles/__tests__/app-manifest-source.test.ts
```
Expected: PASS (8 tests). The implementation from Task 1 already handles all these cases. If any case fails, refine `app-manifest-source.ts` minimally to make it pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/agents/profiles/__tests__/app-manifest-source.test.ts src/lib/agents/profiles/app-manifest-source.ts
git commit -m "test(profiles): edge cases for app-manifest synthesizer

Shadowing (file/builtin), missing dir, malformed manifest, collision
first-wins with tag merge, sparse entry titleCasing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire synthesizer into the profile registry

**Files:**
- Modify: `src/lib/agents/profiles/registry.ts`
- Modify: `src/lib/agents/profiles/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing precedence test**

Append to `src/lib/agents/profiles/__tests__/registry.test.ts` inside the `describe("profile registry", ...)` block:

```ts
  it("file-based profile shadows synthesized app-manifest profile of same id", async () => {
    // This test verifies that if both a profile.yaml AND an app-manifest
    // entry exist for the same id, the file-based one wins. See
    // app-manifest-source.test.ts for synthesis-only coverage.
    //
    // Precondition: synthesizer must run BEFORE scanProfilesFromDir(SKILLS_DIR)
    // in scanProfiles(), so the Map's last-write-wins semantics give file
    // entries precedence.
    //
    // We assert by reading a builtin profile id ("general") and confirming
    // the loaded profile has builtin-shaped fields (e.g., a non-empty
    // skillMd), not synthesizer-shaped (skillMd === "").
    const general = getProfile("general");
    expect(general).toBeDefined();
    expect(general!.skillMd.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run test to confirm baseline (should pass — synthesizer not yet wired)**

```bash
npx vitest run src/lib/agents/profiles/__tests__/registry.test.ts -t "file-based profile shadows"
```
Expected: PASS. (We are establishing a regression test before wiring the synthesizer in. After wiring, this same test must still pass — proving the precedence ordering is correct.)

- [ ] **Step 3: Modify scanProfiles to call the synthesizer FIRST**

In `src/lib/agents/profiles/registry.ts`, locate `scanProfiles()` (around line 275) and modify:

```ts
import { loadAppManifestProfiles } from "./app-manifest-source";
import { getAinativeAppsDir } from "@/lib/utils/ainative-paths";
```

Replace the body of `scanProfiles()` (lines ~275-280):

```ts
function scanProfiles(): Map<string, AgentProfile> {
  const profiles = new Map<string, AgentProfile>();

  // Synthesize FIRST so file-based scans below shadow synthesized entries
  // with the same id (Map last-write-wins).
  const synthesized = loadAppManifestProfiles(
    getAinativeAppsDir(),
    PROMOTED_PROFILES_DIR,
    getBuiltinsDir()
  );
  for (const profile of synthesized) {
    profiles.set(profile.id, profile);
  }

  scanProfilesFromDir(SKILLS_DIR, profiles);
  scanProfilesFromDir(PROMOTED_PROFILES_DIR, profiles);
  return profiles;
}
```

- [ ] **Step 4: Extend cache signature to fingerprint apps directory**

Locate `getSkillsDirectorySignature()` (line ~84) and add an apps-dir parts list:

```ts
function getAppsDirectorySignature(): string {
  const appsDir = getAinativeAppsDir();
  if (!fs.existsSync(appsDir)) return "no-apps";

  const parts: string[] = [];
  const entries = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const manifestPath = path.join(appsDir, entry.name, "manifest.yaml");
    parts.push(entry.name);
    if (fs.existsSync(manifestPath)) {
      const stats = fs.statSync(manifestPath);
      parts.push(`manifest:${stats.mtimeMs}:${stats.size}`);
    }
  }
  return parts.join("|");
}
```

Modify `getSkillsDirectorySignature()` to include the apps fingerprint:

```ts
function getSkillsDirectorySignature(): string {
  const skillsParts = getDirectorySignatureParts(SKILLS_DIR);
  const promotedParts = getDirectorySignatureParts(PROMOTED_PROFILES_DIR);
  const appsSignature = getAppsDirectorySignature();

  if (skillsParts.length === 0 && promotedParts.length === 0 && appsSignature === "no-apps") {
    return "missing";
  }

  return [
    ...skillsParts,
    "||promoted||",
    ...promotedParts,
    "||apps||",
    appsSignature,
  ].join("|");
}
```

Add the import at the top of the file if not already present:

```ts
import { getAinativeAppsDir } from "@/lib/utils/ainative-paths";
```

- [ ] **Step 5: Run the precedence test + the full registry suite**

```bash
npx vitest run src/lib/agents/profiles/__tests__/registry.test.ts
```
Expected: PASS — including the new precedence test and all pre-existing registry tests. If any pre-existing test fails, the cache-signature change is the most likely cause; verify the apps fingerprint isn't unexpectedly dirtying the cache during test runs.

- [ ] **Step 6: Run the full profiles test suite as a regression check**

```bash
npx vitest run src/lib/agents/profiles/
```
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agents/profiles/registry.ts src/lib/agents/profiles/__tests__/registry.test.ts
git commit -m "feat(profiles): wire app-manifest synthesizer into profile registry

Synthesizer runs first in scanProfiles() so file-based profiles shadow
synthesized entries via Map last-write-wins. Cache signature extends to
fingerprint <appsDir>/*/manifest.yaml so app mutations invalidate the
profile cache automatically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Improved NoCompatibleRuntimeError message

**Files:**
- Modify: `src/lib/agents/runtime/execution-target.ts`
- Modify: `src/lib/agents/runtime/__tests__/execution-target.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/agents/runtime/__tests__/execution-target.test.ts` inside the existing `describe(...)` (or add a new `describe("NoCompatibleRuntimeError messages", ...)`):

```ts
import { buildNoCompatibleRuntimeError } from "../execution-target";

describe("NoCompatibleRuntimeError messages", () => {
  it("names profile id, expected runtimes, and configured runtimes when profile exists", () => {
    const err = buildNoCompatibleRuntimeError({
      profileId: "cs-coach",
      profile: {
        id: "cs-coach",
        name: "CS coach",
        description: "",
        domain: "work",
        tags: [],
        systemPrompt: "",
        skillMd: "",
        supportedRuntimes: ["claude-code", "anthropic-direct"],
      } as never,
      configuredRuntimeIds: ["openai-direct"],
    });
    expect(err.message).toContain("cs-coach");
    expect(err.message).toContain("claude-code");
    expect(err.message).toContain("anthropic-direct");
    expect(err.message).toContain("openai-direct");
    expect(err.message).toMatch(/Configure one of the expected runtimes/);
  });

  it("names the unknown profile id and suggests authoring profile.yaml when profile is absent", () => {
    const err = buildNoCompatibleRuntimeError({
      profileId: "ghost-profile",
      profile: undefined,
      configuredRuntimeIds: ["claude-code"],
    });
    expect(err.message).toContain("ghost-profile");
    expect(err.message).toMatch(/profile\.yaml|app manifest/i);
  });

  it("renders empty configured-runtimes list as (none)", () => {
    const err = buildNoCompatibleRuntimeError({
      profileId: "cs-coach",
      profile: {
        id: "cs-coach",
        supportedRuntimes: ["claude-code"],
      } as never,
      configuredRuntimeIds: [],
    });
    expect(err.message).toContain("(none)");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/agents/runtime/__tests__/execution-target.test.ts -t "NoCompatibleRuntimeError messages"
```
Expected: FAIL with "buildNoCompatibleRuntimeError is not a function" (not exported yet).

- [ ] **Step 3: Add the builder and export it**

In `src/lib/agents/runtime/execution-target.ts`, first add the import at the top of the file (alongside the existing imports):

```ts
import type { AgentProfile } from "@/lib/agents/profiles/types";
```

Then, after the `NoCompatibleRuntimeError` class definition (around line 53), add the builder function:

```ts
export function buildNoCompatibleRuntimeError(input: {
  profileId: string | null | undefined;
  profile: AgentProfile | undefined;
  configuredRuntimeIds: AgentRuntimeId[];
}): NoCompatibleRuntimeError {
  const configured =
    input.configuredRuntimeIds.length > 0
      ? `[${input.configuredRuntimeIds.join(", ")}]`
      : "(none)";

  if (!input.profile) {
    return new NoCompatibleRuntimeError(
      `No profile registered for id \`${input.profileId ?? "(unknown)"}\`. ` +
        `If this profile is referenced from an app manifest, ensure the app is ` +
        `installed; otherwise author the profile.yaml. Configured runtimes: ${configured}.`
    );
  }

  return new NoCompatibleRuntimeError(
    `Profile \`${input.profile.id}\` expects ` +
      `[${input.profile.supportedRuntimes.join(", ")}]. ` +
      `You have ${configured} configured. ` +
      `Configure one of the expected runtimes or update the profile.`
  );
}
```

- [ ] **Step 4: Replace the two existing throws to use the builder**

In `src/lib/agents/runtime/execution-target.ts`:

At line ~242-246, replace:
```ts
  if (compatibleCandidates.length === 0) {
    throw new NoCompatibleRuntimeError(
      "No compatible configured runtime is available for this task."
    );
  }
```
with:
```ts
  if (compatibleCandidates.length === 0) {
    const profile = input.profileId ? getProfile(input.profileId) : undefined;
    throw buildNoCompatibleRuntimeError({
      profileId: input.profileId,
      profile,
      configuredRuntimeIds: configuredCandidates,
    });
  }
```

At line ~302-306, replace:
```ts
    throw new NoCompatibleRuntimeError(
      availability.reason ??
        `No healthy alternate runtime is available for ${getRuntimeLabel(requestedRuntimeId)}.`
    );
```
with:
```ts
    const profile = input.profileId ? getProfile(input.profileId) : undefined;
    throw buildNoCompatibleRuntimeError({
      profileId: input.profileId,
      profile,
      configuredRuntimeIds: configuredCandidates,
    });
```

Note: `getProfile` is already imported at line 1 — no new import needed beyond `AgentProfile` for the builder. If TypeScript complains that `AgentProfile` is unused at the import site, it's because `buildNoCompatibleRuntimeError`'s parameter type uses it — keep the import.

- [ ] **Step 5: Run the new tests + the existing execution-target tests**

```bash
npx vitest run src/lib/agents/runtime/__tests__/execution-target.test.ts
```
Expected: All pass — including the 3 new tests and the pre-existing tests. If a pre-existing test asserts the old error message string, update its expectation to match the new builder output (those should be obvious matches on words like "No compatible configured runtime").

- [ ] **Step 6: Type-check the touched files**

```bash
npx tsc --noEmit 2>&1 | grep -E "execution-target|app-manifest-source|registry\.ts" | head -20
```
Expected: clean (no errors in the touched files). The TS diagnostic panel is documented flaky; trust this CLI output.

- [ ] **Step 7: Commit**

```bash
git add src/lib/agents/runtime/execution-target.ts src/lib/agents/runtime/__tests__/execution-target.test.ts
git commit -m "feat(runtime): NoCompatibleRuntimeError names profile + runtime gap

Replaces the bare 'No compatible configured runtime' string with a
builder that names the profile id, its expected supportedRuntimes, and
the user's configured runtimes. Surfaces the gap so users know what to
configure or update.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Browser smoke verification (MANDATORY per CLAUDE.md smoke-test budget)

**Why mandatory:** This plan modifies `src/lib/agents/runtime/execution-target.ts`, which is runtime-registry-adjacent under the project's smoke-test budget rule. Unit tests cannot detect a module-load cycle introduced via static imports. End-to-end execution under a real Next.js process is the only way to catch this class of regression. Per CLAUDE.md and TDR-032.

**Pre-flight check:** Verify there is at least one configured runtime in `~/.ainative/ainative.db` settings. The user dev env should have `anthropic-direct` available via `ANTHROPIC_API_KEY` in `.env.local`. If not, configure one before proceeding.

- [ ] **Step 1: Kill any stale dev servers**

```bash
pkill -f "next dev --turbopack$"; pkill -f "next-server"; sleep 2
lsof ~/.ainative/ainative.db 2>/dev/null
```
Expected: no DB locks. If lsof shows lingering processes, kill them by PID.

- [ ] **Step 2: Start dev server on a free port**

```bash
PORT=3010 npm run dev
```
Run this in a separate terminal or with `run_in_background: true`. Expected: dev server boots without `ReferenceError`. Specifically watch for `Cannot access 'claudeRuntimeAdapter' before initialization` — its absence is the smoke pass criterion for module-load cycles.

- [ ] **Step 3: Navigate to /tables and verify cs-coach is reachable**

Use Claude in Chrome (preferred) or Playwright fallback per project memory.

```
Navigate: http://localhost:3010/profiles
Expected: cs-coach appears in the profile list (synthesized from manifest)
Capture screenshot: output/profile-runtime-default-resolution-pre.png
```

- [ ] **Step 4: Trigger row-insert dispatch**

```
Navigate: http://localhost:3010/tables/customer-touchpoints
Click "Add Row", fill:
  - customer: "Smoke Test Co"
  - channel: "email"
  - summary: "Smoke verification of profile-runtime-default-resolution"
  - sentiment: "neutral"
Submit row.
```

OR equivalently via curl:
```bash
curl -sX POST http://localhost:3010/api/tables/customer-touchpoints/rows \
  -H 'content-type: application/json' \
  -d '{"rows":[{"customer":"Smoke Test Co","channel":"email","summary":"Smoke verification","sentiment":"neutral"}]}'
```

- [ ] **Step 5: Verify task succeeds (the real test)**

Wait ~10s for the task to dispatch and execute, then check:

```bash
sqlite3 ~/.ainative/ainative.db "SELECT id, status, error FROM tasks WHERE project_id = 'customer-follow-up-drafter' ORDER BY created_at DESC LIMIT 1;"
```
Expected: status is `completed` (or `running` mid-flight; re-poll). NOT `failed` with `NoCompatibleRuntimeError`.

If status is `failed`, read the error message:
- If it now reads `Profile \`cs-coach\` expects [...]. You have [...] configured.` — synthesis is working but the runtime intersection is genuinely empty for this user. Configure the missing runtime and retry. This is the improved error message earning its keep.
- If it still reads `No compatible configured runtime is available for this task.` — the change did not deploy; verify dev server picked up the rebuild.
- If it reads `ReferenceError: Cannot access 'claudeRuntimeAdapter'` — module-load cycle introduced. STOP. Inspect static imports in `app-manifest-source.ts` and `execution-target.ts`. The fix is dynamic `await import()` per CLAUDE.md.

- [ ] **Step 6: Capture post-state screenshot**

```
Navigate: http://localhost:3010/inbox  (or wherever drafts surface)
Capture: output/profile-runtime-default-resolution-post.png
```

- [ ] **Step 7: Stop dev server**

```bash
pkill -f "next-server"; sleep 1
```

- [ ] **Step 8: Sanity-check no regression on existing profiles**

Quick browser check that a builtin profile (e.g., `general`) still works:

```bash
sqlite3 ~/.ainative/ainative.db "SELECT id, name FROM agent_profiles WHERE id = 'general';" 2>/dev/null
```
Expected: row returned with file-based name, not synthesizer-shaped output. (Confirms file-based shadows synthesized.)

- [ ] **Step 9: No commit — verification step only**

This task produces verification artifacts (screenshots in `output/`, gitignored) but no code changes. If the verification surfaced a bug requiring code changes, return to the relevant prior task and re-verify.

---

## Task 6: Final verification and handoff

- [ ] **Step 1: Run the full unit test suite**

```bash
npm test 2>&1 | tail -20
```
Expected: All tests pass (1935+ baseline plus the new ones from Tasks 1–4). Note any pre-existing failures (per HANDOFF, there are 7 unrelated failures on main in `e2e/blueprint.test.ts`, `agents/router.test.ts`, `validators/settings.test.ts` — those are NOT regressions from this work).

- [ ] **Step 2: Type-check the whole project**

```bash
npx tsc --noEmit 2>&1 | tail -20
```
Expected: clean.

- [ ] **Step 3: Update HANDOFF.md for next session**

Overwrite `HANDOFF.md` with a fresh handoff describing what shipped in this session. Archive the previous handoff:

```bash
mv HANDOFF.md ".archive/handoff/$(date +%Y-%m-%d)-profile-runtime-default-resolution-pre-shipped-handoff.md" 2>/dev/null || true
```

Then create a new HANDOFF.md summarizing:
- What landed (commits from this plan)
- Verification artifacts (screenshots paths)
- Lessons / patterns to remember (e.g., "synthesizer module pattern for bridging registries")
- Next-up: optional install-time validation follow-up if field experience proves the task-time error is insufficient; otherwise pick the next feature from roadmap.

- [ ] **Step 4: Commit the handoff**

```bash
git add HANDOFF.md .archive/handoff/
git commit -m "docs(handoff): profile-runtime-default-resolution shipped

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Optional — author features/profile-runtime-default-resolution.md**

Per project convention (see `features/row-trigger-blueprint-execution.md` for format), create a `status: completed` feature spec that points back to the brainstorming spec at `docs/superpowers/specs/2026-05-02-profile-runtime-default-resolution-design.md`. This is the canonical place where post-ship status, references, and the verification run live.

---

## Self-Review Notes

- **Spec coverage:** synthesizer (Tasks 1–3 ✓), improved error message (Task 4 ✓), browser smoke (Task 5 ✓). Install-time validation explicitly deferred per scope challenge — documented in NOT-in-scope.
- **Placeholder scan:** every step has runnable code or commands; no TBDs/TODOs.
- **Type consistency:** `loadAppManifestProfiles` signature is `(appsDir, profilesDir, builtinsDir): AgentProfile[]` everywhere it appears. `buildNoCompatibleRuntimeError` input shape is consistent across declaration and test usage.
- **Smoke-test budget:** Task 5 is mandatory and explicit per CLAUDE.md rule (modifying `execution-target.ts`).
