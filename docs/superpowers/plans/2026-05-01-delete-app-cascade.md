# Delete App Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Delete app" action on the app detail screen (`/apps/[id]`) that removes the manifest dir AND every DB row scoped to the app's project, in FK-safe order.

**Architecture:** A thin `deleteAppCascade(appId)` wrapper composes two existing pieces — `deleteProjectCascade(projectId)` from `src/lib/data/delete-project.ts` (already shipped, fully tested by `delete-project.test.ts`) and `deleteApp(id)` from `src/lib/apps/registry.ts`. A new `DELETE /api/apps/[id]` route exposes the wrapper. The detail page mounts a tiny client island (`app-detail-actions.tsx`) hosting a destructive `DropdownMenu` + `ConfirmDialog` (the existing shared component at `src/components/shared/confirm-dialog.tsx`).

**Tech Stack:** Next.js App Router (Server Component page + client island), Drizzle ORM + better-sqlite3, shadcn/ui primitives (`AlertDialog`, `DropdownMenu`), Vitest.

---

## NOT in scope

| Item | Why deferred |
|---|---|
| **Delete-from-list on `/apps/page.tsx`** | User explicitly scoped to detail screen only. Adding a list-card delete button doubles UI surface for the same backend. Add later if usage demands it. |
| **Delete project from `/projects/[id]`** | Already exists (`deleteProjectCascade` wired to `DELETE /api/projects/[id]`). Today's session does not modify it. |
| **Profile / blueprint YAML cleanup under `~/.ainative/profiles/` and `~/.ainative/blueprints/`** | Profiles and blueprints are reusable primitives by design. Confirmation dialog will note they remain available. Adding orphan-detection is a separate feature. |
| **Split-manifest detection (`habit-loop` ↔ `habit-loop--coach`)** | The two-dir split is a transient bug Phase 2 fixes structurally. UI deletion of either side works correctly in isolation; Task #2 cleanup will handle the four leftover dirs by deleting both. |
| **Bulk-delete or undo** | YAGNI for now; AlertDialog provides confirmation, dir + DB rows are easily recreatable from chat. |
| **Soft-delete / archive** | The app registry is file-system-driven; "deleted" = "manifest gone". No archive surface exists today. |

## What already exists

| Asset | Path | Reuse as |
|---|---|---|
| `deleteProjectCascade(projectId): boolean` | `src/lib/data/delete-project.ts` | Core DB cascade. Handles 17 tables in FK-safe order. Returns `false` if project not found. |
| `deleteApp(id, appsDir?): boolean` | `src/lib/apps/registry.ts:205` | Path-traversal-guarded `fs.rmSync` of the app dir. Returns `false` if missing. |
| `getApp(id, appsDir?): AppDetail \| null` | `src/lib/apps/registry.ts:188` | Manifest read for confirmation-dialog summary. |
| `ConfirmDialog` | `src/components/shared/confirm-dialog.tsx` | Pre-styled `AlertDialog` with `destructive` variant — exact use case. |
| `DropdownMenu` shadcn primitive | `src/components/ui/dropdown-menu.tsx` | Header overflow menu, matches `/projects/[id]` and `/schedules/[id]` patterns. |
| `PageShell.actions` slot | `src/components/shared/page-shell.tsx:73-76` | Right-aligned actions row already wired into the detail page header. |
| `delete-project.test.ts` safety-net pattern | `src/app/api/projects/__tests__/delete-project.test.ts` | Reference for the schema-coverage test we'll mirror in app-deletion tests. |
| `ainative-paths.getAinativeAppsDir()` | `src/lib/utils/ainative-paths.ts` | Resolves apps dir for tests / overrides. |
| Existing `deleteApp` tests with `tmp` apps-dir override | `src/lib/apps/__tests__/registry.test.ts:184-209` | Same fixture pattern (`makeTmp`, `writeManifest`, `WEALTH_MANIFEST`) extends naturally to the cascade wrapper. |

## File Structure

```
src/lib/apps/registry.ts              MODIFY  +deleteAppCascade(appId, opts?) — compose deleteProjectCascade + deleteApp
src/lib/apps/__tests__/registry.test.ts
                                      MODIFY  +describe("deleteAppCascade") — 4 cases
src/app/api/apps/[id]/route.ts        CREATE  DELETE handler calling deleteAppCascade
src/app/api/apps/[id]/__tests__/route.test.ts
                                      CREATE  2 cases: 200 happy path, 404 unknown id
src/components/apps/app-detail-actions.tsx
                                      CREATE  Client island: DropdownMenu + ConfirmDialog, calls DELETE, redirects to /apps
src/app/apps/[id]/page.tsx            MODIFY  Replace static <StatusChip/> in actions with <AppDetailActions appId=… ... />
```

Net new: 3 files. Net modified: 2 files. Estimated 80–110 LOC + tests.

## Error & Rescue Registry

| Failure mode | Detection | Recovery |
|---|---|---|
| `deleteProjectCascade` throws (FK constraint, transient SQLite lock) | API route catches, returns `500 { error }` | Client toast surfaces error; user retries. Manifest is NOT removed when DB delete throws — guarantees no orphan dir without DB cleanup. |
| Manifest dir missing but project row exists (e.g., user `rm -rf`'d the dir) | `deleteApp()` returns `false` after DB cascade succeeded | API still returns 200 — DB cleanup is the load-bearing operation. Log a warning but don't fail the user-facing flow. |
| Project row missing but manifest dir exists (split-manifest case, or user-imported manifest) | `deleteProjectCascade()` returns `false` | Continue to `deleteApp()` to remove the dir. API returns 200 with `{ project: false, files: true }`-style summary so the UI knows it was a partial. |
| Both missing (already deleted) | Both helpers return `false` | API returns `404 { error: "Not found" }`. |
| Path-traversal id (`../foo`) | `deleteApp()` guard rejects | API returns `404 { error: "Not found" }` (don't leak the guard's existence). DB cascade is also skipped — `deleteProjectCascade` looks up `projects WHERE id = '../foo'` which finds nothing and returns `false`. |
| Client double-click on Delete | `useTransition` + disabled state on confirm button | Second invocation no-ops; AlertDialog already closed by router push. |
| User navigates away mid-delete | Server-side fetch is fire-and-forget after dispatch | DB transaction is synchronous in better-sqlite3, completes within the request — no orphan state. |
| Module-load cycle risk | None — this work touches only `src/lib/apps/`, `src/app/api/apps/`, `src/components/apps/`, and the page. None of these are in the runtime-registry adjacency list per CLAUDE.md "Smoke-test budget for runtime-registry-adjacent features". | Standard unit tests are sufficient. No `npm run dev` smoke required by the project's writing-plans overrides. |

---

## Task 1: `deleteAppCascade` wrapper (TDD)

**Files:**
- Modify: `src/lib/apps/registry.ts:205-215` (add new export below `deleteApp`)
- Modify: `src/lib/apps/__tests__/registry.test.ts:210` (append new `describe` block)

- [ ] **Step 1: Write the four failing tests**

Append to `src/lib/apps/__tests__/registry.test.ts` after the existing `describe("deleteApp")` block:

```typescript
import { deleteAppCascade } from "../registry";
// (top-of-file import — merge into existing import line)

describe("deleteAppCascade", () => {
  let tmp: string;
  beforeEach(() => { tmp = makeTmp(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it("removes the manifest dir and reports project=false when no DB project exists", () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const result = deleteAppCascade("wealth-tracker", { appsDir: tmp });
    expect(result.filesRemoved).toBe(true);
    expect(result.projectRemoved).toBe(false); // no DB project for this app id in test
    expect(fs.existsSync(path.join(tmp, "wealth-tracker"))).toBe(false);
  });

  it("returns filesRemoved=false projectRemoved=false for an unknown app id", () => {
    const result = deleteAppCascade("does-not-exist", { appsDir: tmp });
    expect(result.filesRemoved).toBe(false);
    expect(result.projectRemoved).toBe(false);
  });

  it("refuses path-traversal ids and removes nothing", () => {
    const appsDir = path.join(tmp, "apps");
    fs.mkdirSync(appsDir, { recursive: true });
    const sibling = path.join(tmp, "other");
    fs.mkdirSync(sibling, { recursive: true });
    fs.writeFileSync(path.join(sibling, "secret.txt"), "keep me", "utf-8");
    const result = deleteAppCascade("../other", { appsDir });
    expect(result.filesRemoved).toBe(false);
    expect(fs.existsSync(path.join(sibling, "secret.txt"))).toBe(true);
  });

  it("calls deleteProjectCascade with the app id (verified via injected fn)", () => {
    writeManifest(tmp, "wealth-tracker", WEALTH_MANIFEST);
    const calls: string[] = [];
    const result = deleteAppCascade("wealth-tracker", {
      appsDir: tmp,
      deleteProjectFn: (id) => { calls.push(id); return true; },
    });
    expect(calls).toEqual(["wealth-tracker"]);
    expect(result.projectRemoved).toBe(true);
    expect(result.filesRemoved).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/apps/__tests__/registry.test.ts -t "deleteAppCascade"`
Expected: 4 failures, all with `deleteAppCascade is not a function` or similar import error.

- [ ] **Step 3: Implement the wrapper**

Append to `src/lib/apps/registry.ts` after the existing `deleteApp` function (after line 215):

```typescript
export interface DeleteAppCascadeResult {
  /** True if the manifest directory was successfully removed. */
  filesRemoved: boolean;
  /** True if a DB project with id === appId existed and its rows were cascaded. */
  projectRemoved: boolean;
}

export interface DeleteAppCascadeOptions {
  appsDir?: string;
  /** Injected for tests; defaults to the real DB-backed deleteProjectCascade. */
  deleteProjectFn?: (projectId: string) => boolean;
}

/**
 * Cascade-delete an app: removes its DB project (and all FK-dependent rows)
 * via deleteProjectCascade, then removes the manifest dir on disk.
 *
 * Both halves are independent — a missing DB project is not an error
 * (split-manifest case), and a missing dir is not an error (DB cleanup
 * already happened). The result reports which half succeeded.
 */
export function deleteAppCascade(
  appId: string,
  options: DeleteAppCascadeOptions = {}
): DeleteAppCascadeResult {
  const appsDir = options.appsDir ?? getAinativeAppsDir();

  // Path-traversal guard: reject before touching anything. Mirrors deleteApp.
  const resolvedApps = path.resolve(appsDir);
  const rootDir = path.resolve(appsDir, appId);
  if (!rootDir.startsWith(resolvedApps + path.sep)) {
    return { filesRemoved: false, projectRemoved: false };
  }

  // DB cleanup first — if it throws (FK violation, lock), the dir stays
  // intact so the user can retry without losing the manifest.
  let projectRemoved = false;
  if (options.deleteProjectFn) {
    projectRemoved = options.deleteProjectFn(appId);
  } else {
    // Lazy import keeps registry.ts free of DB deps for the path-traversal
    // unit test (which never invokes the real cascade).
    const mod = require("@/lib/data/delete-project") as typeof import("@/lib/data/delete-project");
    projectRemoved = mod.deleteProjectCascade(appId);
  }

  const filesRemoved = deleteApp(appId, appsDir);

  return { projectRemoved, filesRemoved };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/apps/__tests__/registry.test.ts -t "deleteAppCascade"`
Expected: 4 passing.

- [ ] **Step 5: Run the full registry suite + tsc**

Run: `npx vitest run src/lib/apps/ && npx tsc --noEmit`
Expected: All registry tests pass, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/apps/registry.ts src/lib/apps/__tests__/registry.test.ts
git commit -m "feat(apps): deleteAppCascade composes deleteProjectCascade + dir removal

$(cat <<'EOF'
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `DELETE /api/apps/[id]` route (TDD)

**Files:**
- Create: `src/app/api/apps/[id]/route.ts`
- Create: `src/app/api/apps/[id]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/apps/[id]/__tests__/route.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/apps/registry", () => ({
  deleteAppCascade: vi.fn(),
}));

import { DELETE } from "../route";
import { deleteAppCascade } from "@/lib/apps/registry";

describe("DELETE /api/apps/[id]", () => {
  beforeEach(() => {
    vi.mocked(deleteAppCascade).mockReset();
  });

  it("returns 200 with the cascade result on success", async () => {
    vi.mocked(deleteAppCascade).mockReturnValue({
      filesRemoved: true,
      projectRemoved: true,
    });
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ id: "wealth-tracker" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      filesRemoved: true,
      projectRemoved: true,
    });
    expect(deleteAppCascade).toHaveBeenCalledWith("wealth-tracker");
  });

  it("returns 404 when both halves report nothing removed", async () => {
    vi.mocked(deleteAppCascade).mockReturnValue({
      filesRemoved: false,
      projectRemoved: false,
    });
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ id: "ghost" }),
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/apps/[id]/__tests__/route.test.ts`
Expected: Both tests fail with "Cannot find module '../route'".

- [ ] **Step 3: Implement the route**

Create `src/app/api/apps/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { deleteAppCascade } from "@/lib/apps/registry";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = deleteAppCascade(id);
    if (!result.filesRemoved && !result.projectRemoved) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      filesRemoved: result.filesRemoved,
      projectRemoved: result.projectRemoved,
    });
  } catch (err) {
    console.error("App delete failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/apps/[id]/__tests__/route.test.ts && npx tsc --noEmit`
Expected: 2 passing, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/apps/[id]/route.ts src/app/api/apps/[id]/__tests__/route.test.ts
git commit -m "feat(api): DELETE /api/apps/[id] cascades app removal

$(cat <<'EOF'
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `app-detail-actions` client island

**Files:**
- Create: `src/components/apps/app-detail-actions.tsx`

This is presentation-only and React-Server-Component-incompatible (it uses state + router). No new behavior to TDD — testing renders requires Testing Library setup not present in this dir today (`src/components/apps/__tests__/starter-template-card.test.tsx` exists but uses RTL; mirror its imports). Keep it short.

- [ ] **Step 1: Write the component**

Create `src/components/apps/app-detail-actions.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

interface AppDetailActionsProps {
  appId: string;
  appName: string;
  tableCount: number;
  scheduleCount: number;
  fileCount: number;
}

export function AppDetailActions({
  appId,
  appName,
  tableCount,
  scheduleCount,
  fileCount,
}: AppDetailActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const summary = [
    tableCount > 0 ? `${tableCount} table${tableCount === 1 ? "" : "s"} (and their rows, columns, triggers)` : null,
    scheduleCount > 0 ? `${scheduleCount} schedule${scheduleCount === 1 ? "" : "s"}` : null,
    fileCount > 0 ? `${fileCount} manifest file${fileCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");

  const description =
    `This will remove ${appName} and ${summary || "its manifest"}. ` +
    `Profiles and blueprints stay available for reuse. This cannot be undone.`;

  function handleConfirm() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/apps/${encodeURIComponent(appId)}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        toast.success(`Deleted ${appName}`);
        setConfirmOpen(false);
        router.push("/apps");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="App actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete app
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !pending && setConfirmOpen(open)}
        title={`Delete ${appName}?`}
        description={description}
        confirmLabel={pending ? "Deleting…" : "Delete app"}
        destructive
        onConfirm={handleConfirm}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify the imports resolve**

Run: `npx tsc --noEmit`
Expected: No TS errors. (If `DropdownMenuItem` doesn't accept `variant`, fall back to `className="text-destructive focus:text-destructive"`.)

- [ ] **Step 3: Verify shadcn primitive surface area**

Quick sanity check that `DropdownMenuItem` supports `variant="destructive"` — peek at the file:

Run: `grep -n "variant" src/components/ui/dropdown-menu.tsx | head -3`
If `variant` is not a prop, change `<DropdownMenuItem variant="destructive" …>` to:
```tsx
<DropdownMenuItem
  className="text-destructive focus:text-destructive focus:bg-destructive/10"
  onSelect={…}
>
```
and re-run `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add src/components/apps/app-detail-actions.tsx
git commit -m "feat(apps): app-detail-actions client island for delete

$(cat <<'EOF'
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire actions into the app detail page

**Files:**
- Modify: `src/app/apps/[id]/page.tsx:27` (replace `actions` prop)

- [ ] **Step 1: Update the page header to mount the new actions island**

In `src/app/apps/[id]/page.tsx`, add the import and replace the `actions` prop. Specifically:

Add after line 6 (`import { getApp } from "@/lib/apps/registry";`):

```typescript
import { AppDetailActions } from "@/components/apps/app-detail-actions";
```

Replace line 27:
```tsx
      actions={<StatusChip status="running" size="md" />}
```
with:
```tsx
      actions={
        <div className="flex items-center gap-2">
          <StatusChip status="running" size="md" />
          <AppDetailActions
            appId={app.id}
            appName={app.name}
            tableCount={app.tableCount}
            scheduleCount={app.scheduleCount}
            fileCount={app.files.length}
          />
        </div>
      }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/apps/[id]/page.tsx
git commit -m "feat(apps): wire AppDetailActions into detail page header

$(cat <<'EOF'
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual smoke + handoff update

This task does NOT require an end-to-end module-load smoke per CLAUDE.md (no runtime-registry-adjacent files touched). It's a behavioral smoke to confirm the UI flow works.

- [ ] **Step 1: Start dev server**

Run: `PORT=3010 npm run dev` (background)
Wait for "Ready in ___ ms" line.

- [ ] **Step 2: Navigate and exercise the delete flow**

Use Claude in Chrome (preferred per project memory) — fall through to Chrome DevTools MCP if it doesn't respond after one retry, then Playwright.

1. Open `http://localhost:3010/apps`
2. Click into one of the leftover smoke apps (recommend `daily-journal` — it has both a table and a schedule, exercising both halves of the cascade)
3. Click the `MoreHorizontal` icon in the header → "Delete app"
4. Confirm the AlertDialog shows: app name, table count, schedule count, file count, "Profiles and blueprints stay available" copy
5. Click "Delete app"
6. Verify: toast "Deleted Daily Journal", redirect to `/apps`, app no longer in list

- [ ] **Step 3: Verify cleanup**

Run in a separate shell:
```bash
ls ~/.ainative/apps/daily-journal 2>&1
sqlite3 ~/.ainative/ainative.db "SELECT id,name FROM projects WHERE id='daily-journal'; SELECT id,name FROM user_tables WHERE project_id='daily-journal'; SELECT id,name FROM schedules WHERE project_id='daily-journal';"
```
Expected: `ls` reports "No such file or directory"; all three SQL queries return zero rows.

- [ ] **Step 4: Stop dev server**

`lsof -i:3010 -t | xargs kill` (or Ctrl-C if foregrounded).

- [ ] **Step 5: Update HANDOFF.md**

Overwrite `HANDOFF.md` with:
- Headline: "Delete-app feature shipped — cascades manifest dir + DB project. Smoke verified by deleting `daily-journal`. Unblocks Task #2 (smoke artifact cleanup) and Task #3 (Phase 2 re-smoke)."
- What shipped: 3 commits, file inventory, test counts.
- Next pickup: Task #2 from the queue — use the new feature to delete the remaining 6 leftover apps; SQL-clean the orphaned UUID-id "Habit Tracker" project from this morning's smoke.

- [ ] **Step 6: Final commit**

```bash
git add HANDOFF.md
git commit -m "docs(handoff): delete-app feature shipped — Task #2 unblocked

$(cat <<'EOF'
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verification summary

| Check | How |
|---|---|
| `deleteAppCascade` covers happy / unknown / traversal / split-manifest paths | 4 unit tests in `registry.test.ts` |
| API route returns correct status codes | 2 unit tests in `route.test.ts` |
| Confirmation dialog shows accurate cascade summary | Manual smoke step 2.4 |
| End-to-end delete removes both manifest dir AND DB project | Manual smoke step 3 |
| No FK constraint violations | Reuses already-tested `deleteProjectCascade` (17 tables, 6 dedicated tests in `delete-project.test.ts`) |
| No TS errors | `npx tsc --noEmit` after each task |
| No regression in app listing / detail page | Manual smoke step 2.6 |
| Module-load cycle smoke | NOT required — touched files are not in the runtime-registry adjacency list per CLAUDE.md |

Total commit count: 5 (one per task). All commits bisectable.
