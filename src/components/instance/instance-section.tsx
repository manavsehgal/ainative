"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface InstanceConfig {
  instanceId: string;
  branchName: string;
  isPrivateInstance: boolean;
  createdAt: number;
}

interface Guardrails {
  prePushHookInstalled: boolean;
  prePushHookVersion: string;
  pushRemoteBlocked: string[];
  consentStatus: "not_yet" | "enabled" | "declined_permanently";
  firstBootCompletedAt: number | null;
}

interface UpgradeState {
  lastPolledAt: number | null;
  upgradeAvailable: boolean;
  commitsBehind: number;
  lastSuccessfulUpgradeAt: number | null;
  pollFailureCount: number;
  lastPollError: string | null;
}

interface ConfigResponse {
  devMode: boolean;
  config: InstanceConfig | null;
  guardrails: Guardrails | null;
  upgrade: UpgradeState | null;
}

/**
 * Settings → Instance section. Compact horizontal strip with title + actions
 * in a top bar and metadata in a 4-column grid below. On the canonical dev
 * repo (devMode=true) collapses to a single-row notice to avoid pretending
 * the main branch is an instance.
 */
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function InstanceSection() {
  const router = useRouter();
  const [state, setState] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"check" | "init" | "upgrade" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/instance/config", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ConfigResponse;
      setState(data);
      return data;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Silent background refresh — used after auto-check on mount so we don't
  // flicker the whole card back to its loading state.
  async function refreshConfigSilent() {
    try {
      const res = await fetch("/api/instance/config", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ConfigResponse;
      setState(data);
    } catch {
      // Swallow — this is a best-effort refresh after auto-check.
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadConfig();
      if (cancelled || !data || data.devMode || !data.config) return;
      // If the cached upgrade state is older than 5 minutes, silently force
      // a fresh check. This self-heals after manual `git pull` + merge in
      // the terminal, so users don't see a stale "N updates pending" count.
      const lastPolled = data.upgrade?.lastPolledAt ?? 0;
      const ageMs = Date.now() - lastPolled * 1000;
      if (ageMs > STALE_THRESHOLD_MS) {
        try {
          const res = await fetch("/api/instance/upgrade/check", {
            method: "POST",
          });
          if (res.ok && !cancelled) {
            await refreshConfigSilent();
          }
        } catch {
          // Silent — manual "Check for upgrades" button remains as fallback.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function checkNow() {
    setBusy("check");
    setMessage(null);
    try {
      const res = await fetch("/api/instance/upgrade/check", { method: "POST" });
      if (res.status === 202) {
        const body = await res.json();
        setMessage(`Check skipped: ${body.skipped ?? body.error ?? "unknown"}`);
      } else if (res.ok) {
        setMessage("Check complete");
        await loadConfig();
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  async function startUpgrade() {
    setBusy("upgrade");
    setMessage(null);
    try {
      const res = await fetch("/api/instance/upgrade", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { taskId: string };
      router.push(`/tasks/${data.taskId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  async function reinit() {
    setBusy("init");
    setMessage(null);
    try {
      const res = await fetch("/api/instance/init", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadConfig();
      setMessage("Instance setup re-run complete");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border bg-card px-5 py-4">
        <h2 className="text-base font-semibold">Instance</h2>
        <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  // Dev mode: main dev repo. Instance bootstrap is gated off. Show a slim
  // single-row notice so the Settings page layout stays stable without
  // misrepresenting the dev repo as an instance.
  if (state?.devMode) {
    return (
      <section className="rounded-xl border bg-card px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Instance</h2>
          <Badge variant="outline" className="text-xs font-normal">
            Dev mode
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Running on the main dev repo. Instance upgrade features are disabled.
          Set{" "}
          <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted">
            STAGENT_INSTANCE_MODE=true
          </code>{" "}
          to test.
        </p>
      </section>
    );
  }

  const config = state?.config ?? null;
  const guardrails = state?.guardrails ?? null;
  const upgrade = state?.upgrade ?? null;
  const hasConfig = config !== null;

  // Not-initialized state
  if (!hasConfig) {
    return (
      <section className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold">Instance</h2>
          <Button
            variant="default"
            size="sm"
            onClick={reinit}
            disabled={busy !== null}
          >
            {busy === "init" ? "Running…" : "Re-run instance setup"}
          </Button>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          Instance setup incomplete — click Re-run setup to initialize.
        </div>
        {message && (
          <div className="text-xs text-muted-foreground">{message}</div>
        )}
      </section>
    );
  }

  const shortId = config!.instanceId.slice(0, 8) + "…";
  const consentLabel = guardrails?.consentStatus ?? "unknown";
  const hookLabel = guardrails?.prePushHookInstalled
    ? `v${guardrails.prePushHookVersion}`
    : "not installed";
  const blockedLabel = guardrails?.pushRemoteBlocked.length
    ? guardrails.pushRemoteBlocked.join(", ")
    : "none";
  const lastCheck = upgrade?.lastPolledAt
    ? new Date(upgrade.lastPolledAt * 1000).toLocaleString()
    : "never";
  const lastUpgrade = upgrade?.lastSuccessfulUpgradeAt
    ? new Date(upgrade.lastSuccessfulUpgradeAt * 1000).toLocaleString()
    : "never";
  const pollFailing = (upgrade?.pollFailureCount ?? 0) > 0;

  const upgradeAvailable = upgrade?.upgradeAvailable ?? false;
  const upgradeCount = upgrade?.commitsBehind ?? 0;
  const startUpgradeDisabled = busy !== null || !upgradeAvailable;
  const startUpgradeTitle = upgradeAvailable
    ? `Merge ${upgradeCount} upstream commit${upgradeCount === 1 ? "" : "s"} into ${config!.branchName}`
    : "No upgrades available — click 'Check for upgrades' to refresh";

  return (
    <div className="space-y-4">
      {/* Primary Instance card — metadata + upgrade action */}
      <section className="rounded-xl border bg-card">
        {/* Header row — title, status badges */}
        <header className="flex items-center justify-between gap-4 px-5 py-3 border-b flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold">Instance</h2>
            {upgradeAvailable && (
              <Badge
                variant="outline"
                className="text-xs font-normal border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
              >
                {upgradeCount} update{upgradeCount === 1 ? "" : "s"} available
              </Badge>
            )}
            {pollFailing && (
              <Badge variant="destructive" className="text-xs font-normal">
                Poll failing ({upgrade?.pollFailureCount})
              </Badge>
            )}
          </div>
        </header>

        {/* Metadata row — 4-column grid fills horizontal width */}
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 px-5 py-3 text-sm">
          <Field label="Branch" mono>
            {config!.branchName}
          </Field>
          <Field
            label="Instance ID"
            mono
            title={config!.instanceId}
          >
            {shortId}
          </Field>
          <Field label="Private">{config!.isPrivateInstance ? "yes" : "no"}</Field>
          <Field label="Consent">{consentLabel}</Field>
          <Field label="Pre-push hook">{hookLabel}</Field>
          <Field label="Blocked branches" truncate>
            {blockedLabel}
          </Field>
          <Field label="Last check">{lastCheck}</Field>
          <Field label="Last upgrade">{lastUpgrade}</Field>
        </dl>

        {(message || pollFailing) && (
          <div className="px-5 pb-3 text-xs text-muted-foreground">
            {pollFailing && upgrade?.lastPollError && (
              <div className="text-amber-700 dark:text-amber-400">
                {upgrade.lastPollError}
              </div>
            )}
            {message && <div>{message}</div>}
          </div>
        )}
      </section>

      {/* Upgrade card — dedicated surface for merging upstream commits */}
      <section className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold">Upgrade instance</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
              Merge the latest upstream commits from{" "}
              <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted">
                main
              </code>{" "}
              into your instance branch{" "}
              <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-muted">
                {config!.branchName}
              </code>
              . Stagent will stash any local changes, fast-forward{" "}
              <code className="font-mono text-[11px]">main</code>, merge into your
              branch, install any new dependencies, and pause to ask you to
              resolve conflicts if they appear. Safe to run — nothing is pushed.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={checkNow}
              disabled={busy !== null}
            >
              {busy === "check" ? "Checking…" : "Check for upgrades"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={startUpgrade}
              disabled={startUpgradeDisabled}
              title={startUpgradeTitle}
            >
              {busy === "upgrade"
                ? "Starting…"
                : upgradeAvailable
                  ? `Start upgrade (${upgradeCount})`
                  : "Start upgrade"}
            </Button>
          </div>
        </div>
        {!upgradeAvailable && (
          <p className="text-[11px] text-muted-foreground">
            No upgrades available. Last checked: {lastCheck}.
          </p>
        )}
      </section>

      {/* Advanced card — re-run setup, de-emphasized and clearly separate */}
      <section className="rounded-xl border bg-card px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold">Advanced: re-run instance setup</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
              Reinstalls the pre-push guardrail hook and recreates instance
              configuration. Only needed if your instance was created before
              guardrails existed, if the git hook was deleted, or if initial
              setup never finished. <strong className="font-medium text-foreground/80">Does not touch your data, your
              branch, or any commits</strong> — this is not an upgrade.
            </p>
          </div>
          <div className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={reinit}
              disabled={busy !== null}
            >
              {busy === "init" ? "Running…" : "Re-run setup"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  mono,
  truncate,
  title,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  truncate?: boolean;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        title={title}
        className={
          "mt-0.5 " +
          (mono ? "font-mono text-xs " : "") +
          (truncate ? "truncate" : "")
        }
      >
        {children}
      </dd>
    </div>
  );
}
