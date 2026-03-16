"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  Tag,
  SlidersHorizontal,
  Wrench,
  FileCode,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { FormSectionCard } from "@/components/shared/form-section-card";
import { listRuntimeCatalog } from "@/lib/agents/runtime/catalog";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface ProfileFormViewProps {
  profileId?: string;
  duplicate?: boolean;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function ProfileFormView({
  profileId,
  duplicate = false,
}: ProfileFormViewProps) {
  const runtimeOptions = listRuntimeCatalog();
  const router = useRouter();
  const isEdit = !!profileId && !duplicate;

  const [fetching, setFetching] = useState(!!profileId);
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [domain, setDomain] = useState<"work" | "personal">("work");
  const [version, setVersion] = useState("1.0.0");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [skillMd, setSkillMd] = useState("");
  const [supportedRuntimes, setSupportedRuntimes] = useState<string[]>([
    "claude-code",
  ]);
  const [codexInstructions, setCodexInstructions] = useState("");
  const [allowedTools, setAllowedTools] = useState("");
  const [maxTurns, setMaxTurns] = useState(30);
  const [outputFormat, setOutputFormat] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch existing profile for edit/duplicate
  useEffect(() => {
    if (!profileId) return;

    fetch(`/api/profiles/${profileId}`)
      .then((r) => r.json())
      .then((profile: AgentProfile) => {
        setName(duplicate ? `${profile.name} (Copy)` : profile.name);
        setId(duplicate ? `${profile.id}-copy` : profile.id);
        setDomain(profile.domain as "work" | "personal");
        setVersion(profile.version ?? "1.0.0");
        setAuthor(profile.author ?? "");
        setTags(profile.tags.join(", "));
        setSkillMd(profile.skillMd ?? "");
        setSupportedRuntimes(profile.supportedRuntimes ?? ["claude-code"]);
        setCodexInstructions(
          profile.runtimeOverrides?.["openai-codex-app-server"]?.instructions ?? ""
        );
        setAllowedTools(profile.allowedTools?.join(", ") ?? "");
        setMaxTurns(profile.maxTurns ?? 30);
        setOutputFormat(profile.outputFormat ?? "");
      })
      .catch(() => {
        toast.error("Failed to load profile");
      })
      .finally(() => setFetching(false));
  }, [profileId, duplicate]);

  // Auto-slug from name (only for create/duplicate)
  const handleNameChange = useCallback(
    (value: string) => {
      setName(value);
      if (!isEdit) {
        setId(toSlug(value));
      }
    },
    [isEdit]
  );

  const handleSubmit = async () => {
    if (!name.trim() || !id.trim()) {
      toast.error("Name and ID are required");
      return;
    }
    if (supportedRuntimes.length === 0) {
      toast.error("Select at least one supported runtime");
      return;
    }

    setSubmitting(true);

    const payload = {
      id,
      name: name.trim(),
      domain,
      version: version.trim() || "1.0.0",
      author: author.trim() || undefined,
      tags: parseCommaSeparated(tags),
      skillMd: skillMd.trim(),
      supportedRuntimes,
      runtimeOverrides: supportedRuntimes.includes("openai-codex-app-server") &&
        codexInstructions.trim()
          ? {
              "openai-codex-app-server": {
                instructions: codexInstructions.trim(),
              },
            }
          : undefined,
      allowedTools: parseCommaSeparated(allowedTools),
      maxTurns,
      outputFormat: outputFormat.trim() || undefined,
    };

    try {
      const url = isEdit ? `/api/profiles/${profileId}` : "/api/profiles";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save profile");
      }

      toast.success(isEdit ? "Profile updated" : "Profile created");

      if (isEdit) {
        router.push(`/profiles/${profileId}`);
      } else {
        router.push(`/profiles/${id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save profile"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg md:col-span-2" />
      </div>
    );
  }

  const title = isEdit
    ? "Edit Profile"
    : duplicate
      ? "Duplicate Profile"
      : "Create Profile";

  const parsedTags = parseCommaSeparated(tags);
  const parsedTools = parseCommaSeparated(allowedTools);
  const lineCount = skillMd.split("\n").length;

  function toggleRuntime(runtimeId: string, checked: boolean) {
    setSupportedRuntimes((current) => {
      if (checked) {
        return current.includes(runtimeId) ? current : [...current, runtimeId];
      }

      return current.filter((candidate) => candidate !== runtimeId);
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Identity */}
        <FormSectionCard icon={User} title="Identity">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Custom Agent"
              />
              <p className="text-xs text-muted-foreground">Display name for this agent</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-id">ID</Label>
              <Input
                id="profile-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="my-custom-agent"
                disabled={isEdit}
              />
              <p className="text-xs text-muted-foreground">Auto-generated slug</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-domain">Domain</Label>
              <Select
                value={domain}
                onValueChange={(v) => setDomain(v as "work" | "personal")}
              >
                <SelectTrigger id="profile-domain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sets default tool permissions</p>
            </div>
          </div>
        </FormSectionCard>

        {/* Metadata */}
        <FormSectionCard icon={Tag} title="Metadata">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-version">Version</Label>
              <Input
                id="profile-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
              <p className="text-xs text-muted-foreground">Semantic version number</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-author">Author</Label>
              <Input
                id="profile-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground">Profile creator attribution</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-tags">Tags</Label>
              <Input
                id="profile-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="coding, review, analysis"
              />
              <p className="text-xs text-muted-foreground">Comma-separated categories</p>
              {parsedTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {parsedTags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FormSectionCard>

        {/* Model Tuning */}
        <FormSectionCard icon={SlidersHorizontal} title="Model Tuning">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-turns">Max Turns</Label>
                <Badge variant="secondary" className="tabular-nums text-xs">
                  {maxTurns}
                </Badge>
              </div>
              <Slider
                id="profile-turns"
                min={1}
                max={100}
                step={1}
                value={[maxTurns]}
                onValueChange={([v]) => setMaxTurns(v)}
              />
              <p className="text-xs text-muted-foreground">Max agent-tool cycles per execution</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-format">Output Format</Label>
              <Input
                id="profile-format"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
                placeholder="e.g., markdown, json"
              />
              <p className="text-xs text-muted-foreground">Preferred response format</p>
            </div>
          </div>
        </FormSectionCard>

        {/* Runtime Coverage */}
        <FormSectionCard icon={Cpu} title="Runtime Coverage">
          <div className="space-y-3">
            {runtimeOptions.map((runtime) => (
              <div
                key={runtime.id}
                className="surface-card-muted flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{runtime.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {runtime.id === "claude-code"
                      ? "Shared SKILL.md instructions apply here by default"
                      : "Enable when this profile should be selectable on Codex"}
                  </p>
                </div>
                <Switch
                  checked={supportedRuntimes.includes(runtime.id)}
                  onCheckedChange={(checked) => toggleRuntime(runtime.id, checked)}
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Runtime support is enforced across tasks, schedules, workflow steps, and profile tests.
            </p>
          </div>
        </FormSectionCard>

        {/* Tools */}
        <FormSectionCard icon={Wrench} title="Tools" className="lg:col-span-1 md:col-span-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-tools">Allowed Tools</Label>
            <Input
              id="profile-tools"
              value={allowedTools}
              onChange={(e) => setAllowedTools(e.target.value)}
              placeholder="Read, Edit, Bash, Grep"
            />
            <p className="text-xs text-muted-foreground">Leave empty to allow all tools</p>
            {parsedTools.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {parsedTools.map((tool, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </FormSectionCard>

        {/* Codex Override */}
        {supportedRuntimes.includes("openai-codex-app-server") && (
          <FormSectionCard
            icon={Cpu}
            title="Codex Override"
            className="md:col-span-2 lg:col-span-1"
          >
            <div className="space-y-1.5">
              <Label htmlFor="profile-codex-instructions">
                OpenAI Codex Instructions
              </Label>
              <Textarea
                id="profile-codex-instructions"
                value={codexInstructions}
                onChange={(e) => setCodexInstructions(e.target.value)}
                placeholder="Optional runtime-specific override. Leave empty to reuse SKILL.md."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Optional provider-specific instructions for Codex. Shared tools and policies still apply unless overridden in profile metadata.
              </p>
            </div>
          </FormSectionCard>
        )}

        {/* SKILL.md */}
        <FormSectionCard
          icon={FileCode}
          title="SKILL.md"
          className="md:col-span-2 lg:col-span-2 lg:row-span-2"
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="profile-skillmd">Instructions</Label>
              <Badge variant="secondary" className="text-xs">
                {lineCount} {lineCount === 1 ? "line" : "lines"}
              </Badge>
            </div>
            <Textarea
              id="profile-skillmd"
              value={skillMd}
              onChange={(e) => setSkillMd(e.target.value)}
              placeholder="Behavioral instructions for the agent..."
              className="font-mono"
              rows={12}
            />
            <p className="text-xs text-muted-foreground">Markdown instructions defining agent behavior</p>
          </div>
        </FormSectionCard>

        {/* Actions */}
        <div className="col-span-full flex items-center gap-3 pt-2">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? "Saving..."
              : isEdit
                ? "Update Profile"
                : "Create Profile"}
          </Button>
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
