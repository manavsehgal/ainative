"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Check, Loader2 } from "lucide-react";
import type { ProfileSuggestion } from "@/lib/environment/profile-rules";

interface ProfileCreateDialogProps {
  suggestion: ProfileSuggestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileCreateDialog({
  suggestion,
  open,
  onOpenChange,
}: ProfileCreateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  // Reset form when suggestion changes
  if (suggestion && name === "" && systemPrompt === "") {
    setName(suggestion.name);
    setSystemPrompt(suggestion.systemPrompt);
    setCreated(false);
  }

  const handleCreate = async () => {
    if (!suggestion) return;
    setCreating(true);
    try {
      await fetch("/api/environment/profiles/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion,
          overrides: {
            name: name !== suggestion.name ? name : undefined,
            systemPrompt: systemPrompt !== suggestion.systemPrompt ? systemPrompt : undefined,
          },
        }),
      });
      setCreated(true);
      router.refresh();
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setName("");
    setSystemPrompt("");
    setCreated(false);
    onOpenChange(false);
  };

  if (!suggestion) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Create Agent Profile
          </DialogTitle>
          <DialogDescription>
            Customize and create from the {suggestion.name} suggestion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Profile Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Matched artifacts */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Based on these artifacts
            </label>
            <div className="flex flex-wrap gap-1">
              {suggestion.matchedArtifacts.map((a) => (
                <Badge key={a.id} variant="secondary" className="text-xs">
                  {a.name} ({a.category})
                </Badge>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              System Prompt
            </label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="text-xs"
            />
          </div>

          {/* Tools */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Allowed Tools
            </label>
            <div className="flex flex-wrap gap-1">
              {suggestion.suggestedTools.map((tool) => (
                <Badge key={tool} variant="outline" className="text-xs">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div className="text-xs text-muted-foreground">
            Confidence: {Math.round(suggestion.confidence * 100)}%
          </div>

          {/* Success message */}
          {created && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-800 p-3">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                Profile created! View it in Profiles.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {created ? "Close" : "Cancel"}
          </Button>
          {!created && (
            <Button onClick={handleCreate} disabled={creating || !name.trim()}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Profile"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
