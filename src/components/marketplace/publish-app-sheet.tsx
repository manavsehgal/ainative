"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppCatalogEntry } from "@/lib/apps/types";

interface PublishAppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  app: AppCatalogEntry | null;
  onPublished?: () => void;
}

const CATEGORIES = ["finance", "sales", "content", "dev", "automation", "general"];

export function PublishAppSheet({
  open,
  onOpenChange,
  app,
  onPublished,
}: PublishAppSheetProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [tags, setTags] = useState("");
  const [pricingType, setPricingType] = useState<"free" | "paid">("free");
  const [priceCents, setPriceCents] = useState(0);
  const [readme, setReadme] = useState("");
  const [publishing, setPublishing] = useState(false);

  // Pre-fill from app when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && app) {
      setTitle(app.name);
      setDescription(app.description);
      setCategory(app.category);
      setTags(app.tags.join(", "));
    }
    onOpenChange(isOpen);
  };

  async function handlePublish() {
    if (!app) return;
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    setPublishing(true);
    try {
      // Fetch app detail for manifest
      const detailRes = await fetch(`/api/apps/catalog/${app.appId}`);
      if (!detailRes.ok) throw new Error("Failed to load app details");
      const detail = await detailRes.json();

      // Build metadata
      const metadata = {
        appId: app.appId,
        version: app.version,
        title: title.trim(),
        description: description.trim(),
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        pricingType,
        priceCents: pricingType === "paid" ? priceCents : 0,
        readme: readme.trim() || undefined,
        manifestJson: JSON.stringify(detail.app),
      };

      // For now, create a placeholder archive (real archive would come from pack)
      const sapBlob = new Blob(
        [JSON.stringify({ manifest: detail.app, whatsIncluded: detail.whatsIncluded })],
        { type: "application/json" },
      );

      const formData = new FormData();
      formData.append("sap", sapBlob, `${app.appId}-${app.version}.sap`);
      formData.append("metadata", JSON.stringify(metadata));

      const res = await fetch("/api/marketplace/publish-app", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Publish failed");
      }

      toast.success(`Published "${title}" to the marketplace!`);
      onOpenChange(false);
      onPublished?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="p-4">
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Publish App
          </SheetTitle>
          <SheetDescription>
            Submit your app to the Stagent marketplace for others to discover and install.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-5 overflow-y-auto">
          {/* Basic Info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pub-title">Title</Label>
              <Input
                id="pub-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="My Awesome App"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pub-desc">Description</Label>
              <Textarea
                id="pub-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="What does this app do?"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pub-tags">Tags (comma-separated)</Label>
              <Input
                id="pub-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="portfolio, investing, tax"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <Label>Pricing</Label>
            <div className="flex items-center gap-3">
              <Badge
                variant={pricingType === "free" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setPricingType("free")}
              >
                Free
              </Badge>
              <Badge
                variant={pricingType === "paid" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setPricingType("paid")}
              >
                Paid
              </Badge>
            </div>
            {pricingType === "paid" && (
              <div className="space-y-1.5">
                <Label htmlFor="pub-price">Price (USD)</Label>
                <Input
                  id="pub-price"
                  type="number"
                  min={1}
                  max={25}
                  step={0.5}
                  value={priceCents / 100}
                  onChange={(e) =>
                    setPriceCents(Math.round(parseFloat(e.target.value) * 100))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Stagent takes a 20% platform fee.
                </p>
              </div>
            )}
          </div>

          {/* README */}
          <div className="space-y-1.5">
            <Label htmlFor="pub-readme">README (Markdown)</Label>
            <Textarea
              id="pub-readme"
              value={readme}
              onChange={(e) => setReadme(e.target.value)}
              rows={5}
              placeholder="# My App\n\nDescribe your app in detail..."
              className="font-mono text-xs"
            />
          </div>

          {/* Manifest summary */}
          {app && (
            <div className="surface-card-muted rounded-lg border p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Package Contents
              </h3>
              <div className="flex flex-wrap gap-3 text-sm">
                <span>{app.tableCount} tables</span>
                <span>{app.scheduleCount} schedules</span>
                <span>{app.profileCount} profiles</span>
                <span>{app.blueprintCount} blueprints</span>
              </div>
              <div className="text-xs text-muted-foreground">
                v{app.version} · {app.difficulty} · ~{app.estimatedSetupMinutes} min setup
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2">
            <Button
              onClick={handlePublish}
              disabled={publishing || !title.trim() || !description.trim()}
              className="w-full"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Publish to Marketplace
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
