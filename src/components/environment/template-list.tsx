"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Package, Plus, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import type { EnvironmentTemplateRow } from "@/lib/db/schema";

interface TemplateListProps {
  templates: EnvironmentTemplateRow[];
  scanId?: string;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function TemplateList({ templates, scanId }: TemplateListProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!scanId || !newName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/environment/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId, name: newName.trim() }),
      });
      setNewName("");
      setShowForm(false);
      router.refresh();
    } finally {
      setCreating(false);
    }
  }, [scanId, newName, router]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/environment/templates/${id}`, { method: "DELETE" });
    router.refresh();
  };

  if (templates.length === 0 && !showForm) {
    return (
      <EmptyState
        icon={Package}
        heading="No templates yet"
        description="Save your current environment as a reusable template."
        action={
          scanId ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </h3>
        {scanId && !showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Save as Template
          </Button>
        )}
      </div>

      {/* Capture form */}
      {showForm && (
        <Card className="border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Input
              placeholder="Template name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCapture();
              }}
            />
            <Button size="sm" onClick={handleCapture} disabled={creating || !newName.trim()}>
              {creating ? "Saving..." : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template cards */}
      <div className="space-y-2">
        {templates.map((tmpl) => (
          <Card key={tmpl.id} className="elevation-1">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tmpl.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatRelativeTime(tmpl.createdAt)}
                    </span>
                    <span>{tmpl.artifactCount} artifacts</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {tmpl.scope}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(tmpl.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
