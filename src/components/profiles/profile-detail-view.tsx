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
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  results: TestResult[];
  totalPassed: number;
  totalFailed: number;
}

interface ProfileWithBuiltin extends AgentProfile {
  isBuiltin?: boolean;
}

interface ProfileDetailViewProps {
  profileId: string;
  isBuiltin: boolean;
}

export function ProfileDetailView({ profileId, isBuiltin }: ProfileDetailViewProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileWithBuiltin | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testReport, setTestReport] = useState<TestReport | null>(null);
  const [runningTests, setRunningTests] = useState(false);

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
    refresh();
  }, [refresh]);

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
      });
      if (res.ok) {
        const report: TestReport = await res.json();
        setTestReport(report);
        if (report.totalFailed === 0) {
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

      {/* Bento Grid: Identity + Configuration + Tools & Policy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Identity Card */}
        <Card>
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
              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t">
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
        <Card>
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

        {/* Tools & Policy Card */}
        <Card className="md:col-span-2 lg:col-span-1">
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
                      className="border-green-500/30 bg-green-500/10 text-xs text-green-700 dark:text-green-400"
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
                      className="border-red-500/30 bg-red-500/10 text-xs text-red-700 dark:text-red-400"
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

      {/* Bottom row: SKILL.md + Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        {/* SKILL.md — collapsible */}
        {profile.skillMd && (
          <details className="group" open>
            <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span>SKILL.md</span>
              <Badge variant="secondary" className="text-xs ml-auto">
                {lineCount} lines
              </Badge>
              <span className="text-muted-foreground text-xs group-open:rotate-90 transition-transform">▶</span>
            </summary>
            <div className="mt-2 rounded-lg border bg-card p-4">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs">
                {profile.skillMd}
              </pre>
            </div>
          </details>
        )}

        {/* Tests */}
        {profile.tests && profile.tests.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Tests ({profile.tests.length})
                </CardTitle>
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
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Test Summary Bar */}
              {testReport && (
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
                  const result = testReport?.results[i];
                  return (
                    <div key={i} className="rounded-md border p-2 text-sm">
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
                                      ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                                      : missing
                                        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
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
