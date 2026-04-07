"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
  config: InstanceConfig | null;
  guardrails: Guardrails;
  upgrade: UpgradeState;
}

/**
 * Settings → Instance section. Shows the current instance config, guardrail
 * status, and upgrade history, with actions to trigger a manual upgrade check
 * or re-run the instance setup.
 *
 * Rendered in the Settings page as a labeled row list. Dense but discoverable
 * per the UX spec in features/upgrade-session.md.
 */
export function InstanceSection() {
  const [state, setState] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"check" | "init" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/instance/config", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ConfigResponse;
      setState(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
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
      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Instance</h2>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </section>
    );
  }

  const hasConfig = state?.config !== null;
  const guardrails = state?.guardrails;
  const upgrade = state?.upgrade;

  return (
    <section className="space-y-4 rounded-lg border p-6">
      <div>
        <h2 className="text-lg font-semibold">Instance</h2>
        <p className="text-sm text-muted-foreground">
          This instance is running on branch{" "}
          <code className="font-mono text-xs">
            {state?.config?.branchName ?? "(not initialized)"}
          </code>
          . Upgrades pull in upstream commits from <code className="font-mono text-xs">main</code>{" "}
          while keeping your customizations.
        </p>
      </div>

      {!hasConfig && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Instance setup incomplete — click Re-run setup below.
        </div>
      )}

      {hasConfig && (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Instance ID</dt>
          <dd className="font-mono text-xs break-all">{state?.config?.instanceId}</dd>

          <dt className="text-muted-foreground">Branch</dt>
          <dd className="font-mono text-xs">{state?.config?.branchName}</dd>

          <dt className="text-muted-foreground">Private instance</dt>
          <dd>{state?.config?.isPrivateInstance ? "yes" : "no"}</dd>

          <dt className="text-muted-foreground">Pre-push hook</dt>
          <dd>
            {guardrails?.prePushHookInstalled
              ? `installed (v${guardrails.prePushHookVersion})`
              : "not installed"}
          </dd>

          <dt className="text-muted-foreground">Blocked branches</dt>
          <dd>
            {guardrails?.pushRemoteBlocked.length
              ? guardrails.pushRemoteBlocked.join(", ")
              : "none"}
          </dd>

          <dt className="text-muted-foreground">Consent</dt>
          <dd>{guardrails?.consentStatus}</dd>

          <dt className="text-muted-foreground">Last upgrade check</dt>
          <dd>
            {upgrade?.lastPolledAt
              ? new Date(upgrade.lastPolledAt * 1000).toLocaleString()
              : "never"}
          </dd>

          <dt className="text-muted-foreground">Last successful upgrade</dt>
          <dd>
            {upgrade?.lastSuccessfulUpgradeAt
              ? new Date(upgrade.lastSuccessfulUpgradeAt * 1000).toLocaleString()
              : "never"}
          </dd>

          {(upgrade?.pollFailureCount ?? 0) > 0 && (
            <>
              <dt className="text-muted-foreground">Poll failures</dt>
              <dd className="text-amber-700 dark:text-amber-400">
                {upgrade?.pollFailureCount} — {upgrade?.lastPollError}
              </dd>
            </>
          )}
        </dl>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          variant="default"
          size="sm"
          onClick={checkNow}
          disabled={busy !== null}
        >
          {busy === "check" ? "Checking…" : "Check for upgrades now"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={reinit}
          disabled={busy !== null}
        >
          {busy === "init" ? "Running…" : "Re-run instance setup"}
        </Button>
      </div>

      {message && (
        <div className="text-xs text-muted-foreground">{message}</div>
      )}
    </section>
  );
}
