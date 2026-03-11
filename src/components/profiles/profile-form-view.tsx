"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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

export function ProfileFormView({
  profileId,
  duplicate = false,
}: ProfileFormViewProps) {
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
  const [allowedTools, setAllowedTools] = useState("");
  const [temperature, setTemperature] = useState("0.5");
  const [maxTurns, setMaxTurns] = useState("30");
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
        setAllowedTools(profile.allowedTools?.join(", ") ?? "");
        setTemperature(String(profile.temperature ?? 0.5));
        setMaxTurns(String(profile.maxTurns ?? 30));
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

    setSubmitting(true);

    const payload = {
      id,
      name: name.trim(),
      domain,
      version: version.trim() || "1.0.0",
      author: author.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      skillMd: skillMd.trim(),
      allowedTools: allowedTools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      temperature: parseFloat(temperature) || 0.5,
      maxTurns: parseInt(maxTurns, 10) || 30,
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
      <Card className="max-w-3xl">
        <CardHeader>
          <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const title = isEdit
    ? "Edit Profile"
    : duplicate
      ? "Duplicate Profile"
      : "Create Profile";

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Name + ID */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Custom Agent"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-id">ID</Label>
              <Input
                id="profile-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="my-custom-agent"
                disabled={isEdit}
              />
            </div>
          </div>

          {/* Domain */}
          <div className="grid gap-2">
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
          </div>

          {/* Version + Author */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-version">Version</Label>
              <Input
                id="profile-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-author">Author</Label>
              <Input
                id="profile-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="profile-tags">Tags</Label>
            <Input
              id="profile-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="coding, review, analysis"
            />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          {/* SKILL.md */}
          <div className="grid gap-2">
            <Label htmlFor="profile-skillmd">SKILL.md</Label>
            <Textarea
              id="profile-skillmd"
              value={skillMd}
              onChange={(e) => setSkillMd(e.target.value)}
              placeholder="Behavioral instructions for the agent..."
              className="font-mono"
              rows={16}
            />
          </div>

          {/* Allowed Tools */}
          <div className="grid gap-2">
            <Label htmlFor="profile-tools">Allowed Tools</Label>
            <Input
              id="profile-tools"
              value={allowedTools}
              onChange={(e) => setAllowedTools(e.target.value)}
              placeholder="Read, Edit, Bash, Grep"
            />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          {/* Temperature + Max Turns */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-temp">Temperature</Label>
              <Input
                id="profile-temp"
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-turns">Max Turns</Label>
              <Input
                id="profile-turns"
                type="number"
                min={1}
                value={maxTurns}
                onChange={(e) => setMaxTurns(e.target.value)}
              />
            </div>
          </div>

          {/* Output Format */}
          <div className="grid gap-2">
            <Label htmlFor="profile-format">Output Format</Label>
            <Input
              id="profile-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              placeholder="Optional (e.g., markdown, json)"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
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
      </CardContent>
    </Card>
  );
}
