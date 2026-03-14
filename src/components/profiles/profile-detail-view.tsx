"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Pencil,
  Trash2,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Bot,
  Sparkles,
  Tag,
  User,
  Thermometer,
  Repeat,
  FileOutput,
  Wrench,
  ShieldCheck,
  ShieldX,
  FileCode,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LearnedContextPanel } from "@/components/profiles/learned-context-panel";
import {
  type AgentRuntimeId,
  DEFAULT_AGENT_RUNTIME,
  listRuntimeCatalog,
} from "@/lib/agents/runtime/catalog";
import {
  getProfileRuntimeCompatibility,
  getSupportedRuntimes,
} from "@/lib/agents/profiles/compatibility";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface TestResult {
  task: string;
  expectedKeywords: string[];
  foundKeywords: string[];
  missingKeywords: string[];
  passed: boolean;
}

interface TestReport {
  profileId: string;
  profileName: string;
  runtimeId: string;
  results: TestResult[];
  totalPassed: number;
  totalFailed: number;
  unsupported?: boolean;
  unsupportedReason?: string;
}

interface ProfileWithBuiltin extends AgentProfile {
  isBuiltin?: boolean;
}

interface ProfileDetailViewProps {
  profileId: string;
  isBuiltin: boolean;
  initialProfile?: AgentProfile;
}

export function ProfileDetailView({ profileId, isBuiltin, initialProfile }: ProfileDetailViewProps) {
  const runtimeOptions = listRuntimeCatalog();
  const runtimeLabelMap = new Map(
    runtimeOptions.map((runtime) => [runtime.id, runtime.label])
  );
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileWithBuiltin | null>(initialProfile ?? null);
  const [loaded, setLoaded] = useState(!!initialProfile);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [selectedTestRuntime, setSelectedTestRuntime] =
    useState<AgentRuntimeId>(DEFAULT_AGENT_RUNTIME);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}`);
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch {
      // silent
    }
    setLoaded(true);
  }, [profileId]);

  useEffect(() => {
    // Skip initial fetch if server provided data — only refresh on mutations
    if (!initialProfile) refresh();
  }, [refresh, initialProfile]);

  async function handleDelete() {
    setConfirmDelete(false);
    try {
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Profile deleted");
        router.push("/profiles");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to delete profile");
      }
    } catch {
      toast.error("Network error");
    }
  }

  async function handleRunTests() {
    setRunningTests(true);
    setTestReport(null);
    try {
      const res = await fetch(`/api/profiles/${profileId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runtimeId: selectedTestRuntime }),
      });
      if (res.ok) {
        const report: TestReport = await res.json();
        setTestReport(report);
        if (report.unsupported) {
          toast.warning(report.unsupportedReason ?? "This runtime cannot test the selected profile");
        } else if (report.totalFailed === 0) {
          toast.success(`All ${report.totalPassed} tests passed`);
        } else {
          toast.warning(`${report.totalPassed} passed, ${report.totalFailed} failed`);
        }
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Failed to run tests");
      }
    } catch {
      toast.error("Network error running tests");
    } finally {
      setRunningTests(false);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-muted-foreground">Profile not found.</p>;
  }

  const DomainIcon = profile.domain === "work" ? Bot : Sparkles;
  const lineCount = profile.skillMd ? profile.skillMd.split("\n").length : 0;
  const toolCount = (profile.allowedTools?.length ?? 0);
  const hasPolicy = profile.canUseToolPolicy &&
    ((profile.canUseToolPolicy.autoApprove?.length ?? 0) > 0 ||
     (profile.canUseToolPolicy.autoDeny?.length ?? 0) > 0);
  const testTotal = testReport ? testReport.totalPassed + testReport.totalFailed : 0;
  const runtimeCompatibility = runtimeOptions.map((runtime) => ({
    runtime,
    compatibility: getProfileRuntimeCompatibility(profile, runtime.id),
  }));

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{profile.name}</h1>
          <Badge variant={profile.domain === "work" ? "default" : "secondary"}>
            {profile.domain}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {!isBuiltin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/profiles/${profileId}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/profiles/${profileId}/edit?duplicate=true`)}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Duplicate
          </Button>
          {!isBuiltin && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Bento Grid: Identity + Configuration + Runtime Coverage + Tools & Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Identity Card */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DomainIcon className="h-4 w-4 text-muted-foreground" />
              Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{profile.description}</p>
            {profile.tags && profile.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {profile.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            {(profile.version || profile.author) && (
              <div className="flex items-center gap-3 border-t border-border/60 pt-1 text-xs text-muted-foreground">
                {profile.version && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />v{profile.version}
                  </span>
                )}
                {profile.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />{profile.author}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Card */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Temperature Gauge */}
            {profile.temperature !== undefined && (
              <div className="flex items-center gap-2">
                <Thermometer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-20">Temperature</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(profile.temperature / 2) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right">{profile.temperature}</span>
              </div>
            )}
            {/* Max Turns */}
            {profile.maxTurns !== undefined && (
              <div className="flex items-center gap-2">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Max Turns</span>
                <span className="text-xl font-bold ml-auto">{profile.maxTurns}</span>
              </div>
            )}
            {/* Output Format */}
            {profile.outputFormat && (
              <div className="flex items-center gap-2">
                <FileOutput className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">Output</span>
                <Badge variant="outline" className="text-xs ml-auto">
                  {profile.outputFormat}
                </Badge>
              </div>
            )}
            {!profile.temperature && !profile.maxTurns && !profile.outputFormat && (
              <p className="text-sm text-muted-foreground">Default configuration</p>
            )}
          </CardContent>
        </Card>

        {/* Runtime Coverage */}
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              Runtime Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {runtimeCompatibility.map(({ runtime, compatibility }) => (
              <div
                key={runtime.id}
                className="surface-card-muted rounded-lg border border-border/60 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{runtime.label}</span>
                  <Badge
                    variant={compatibility.supported ? "secondary" : "outline"}
                    className={
                      compatibility.supported
                        ? "bg-status-completed/10 text-status-completed"
                        : "text-muted-foreground"
                    }
                  >
                    {compatibility.supported ? "Supported" : "Unsupported"}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {compatibility.supported
                    ? compatibility.instructionsSource === "runtime-override"
                      ? "Uses runtime-specific instructions"
                      : "Uses shared SKILL.md instructions"
                    : "Blocked before execution"}
                </p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {`Supports ${getSupportedRuntimes(profile)
                .map((runtimeId) => runtimeLabelMap.get(runtimeId) ?? runtimeId)
                .join(", ")}`}
            </p>
          </CardContent>
        </Card>

        {/* Tools & Policy Card */}
        <Card className="surface-card md:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              Tools & Policy
              {toolCount > 0 && (
                <Badge variant="secondary" className="text-xs ml-auto">{toolCount}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Allowed Tools */}
            {profile.allowedTools && profile.allowedTools.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {profile.allowedTools.map((tool) => (
                  <Badge key={tool} variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">All tools allowed</p>
            )}

            {/* Auto-approve */}
            {hasPolicy && profile.canUseToolPolicy?.autoApprove && profile.canUseToolPolicy.autoApprove.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <ShieldCheck className="h-3 w-3 text-status-completed" />
                  <span>Auto-approve</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.canUseToolPolicy.autoApprove.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="border-status-completed/30 bg-status-completed/10 text-xs text-status-completed"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-deny */}
            {hasPolicy && profile.canUseToolPolicy?.autoDeny && profile.canUseToolPolicy.autoDeny.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <ShieldX className="h-3 w-3 text-status-failed" />
                  <span>Auto-deny</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {profile.canUseToolPolicy.autoDeny.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="border-status-failed/30 bg-status-failed/10 text-xs text-status-failed"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {!toolCount && !hasPolicy && (
              <p className="text-xs text-muted-foreground">No tool restrictions</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Learned Context */}
      <LearnedContextPanel profileId={profileId} />

      {/* Bottom row: SKILL.md + Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* SKILL.md — collapsible */}
        {profile.skillMd && (
          <details className="group" open>
            <summary className="surface-card flex cursor-pointer list-none items-center gap-2 rounded-lg p-3 text-sm font-medium transition-colors hover:bg-accent/50">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span>SKILL.md</span>
              <Badge variant="secondary" className="text-xs ml-auto">
                {lineCount} lines
              </Badge>
              <span className="text-muted-foreground text-xs group-open:rotate-90 transition-transform">▶</span>
            </summary>
            <div className="surface-panel mt-2 rounded-lg p-4">
              <pre className="surface-scroll max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-4 text-xs">
                {profile.skillMd}
              </pre>
            </div>
          </details>
        )}

        {/* Tests */}
        {profile.tests && profile.tests.length > 0 && (
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Tests ({profile.tests.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                    <select
                      value={selectedTestRuntime}
                      onChange={(event) =>
                        setSelectedTestRuntime(event.target.value as AgentRuntimeId)
                      }
                      className="surface-control h-7 rounded-md border border-border/60 px-2 text-xs"
                    >
                    {runtimeOptions.map((runtime) => (
                      <option key={runtime.id} value={runtime.id}>
                        {runtime.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunTests}
                    disabled={runningTests}
                    className="h-7"
                  >
                    {runningTests ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    {runningTests ? "Running..." : "Run Tests"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {testReport?.unsupported && (
                <div className="surface-card-muted rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                  {testReport.unsupportedReason ??
                    `${runtimeLabelMap.get(selectedTestRuntime) ?? selectedTestRuntime} cannot test this profile yet`}
                </div>
              )}
              {/* Test Summary Bar */}
              {testReport && !testReport.unsupported && (
                <div className="space-y-1">
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                    <div
                      className="bg-status-completed"
                      style={{ width: `${(testReport.totalPassed / testTotal) * 100}%` }}
                    />
                    <div
                      className="bg-status-failed"
                      style={{ width: `${(testReport.totalFailed / testTotal) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {testReport.totalPassed}/{testTotal} passed
                  </p>
                </div>
              )}
              {/* Test Items */}
              <div className="space-y-1.5">
                {profile.tests.map((test, i) => {
                  const result = testReport?.unsupported ? undefined : testReport?.results[i];
                  return (
                    <div key={i} className="surface-card-muted rounded-md border p-2 text-sm">
                      <div className="flex items-start gap-2">
                        {result && (
                          result.passed ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-completed" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-failed" />
                          )
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{test.task}</p>
                          <div className="mt-1 flex flex-wrap gap-0.5">
                            {test.expectedKeywords.map((kw) => {
                              const found = result?.foundKeywords.includes(kw);
                              const missing = result?.missingKeywords.includes(kw);
                              return (
                                <Badge
                                  key={kw}
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    found
                                      ? "border-status-completed/30 bg-status-completed/10 text-status-completed"
                                      : missing
                                        ? "border-status-failed/30 bg-status-failed/10 text-status-failed"
                                        : ""
                                  }`}
                                >
                                  {kw}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete Profile"
        description="This will permanently delete this custom profile."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}
