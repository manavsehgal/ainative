"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { BlueprintCard } from "./blueprint-card";
import type { MarketplaceBlueprint } from "@/lib/marketplace/marketplace-client";

interface MarketplaceBrowserProps {
  canImport: boolean;
  canPublish: boolean;
}

const CATEGORIES = ["all", "general", "research", "content", "data", "automation"];

export function MarketplaceBrowser({ canImport }: MarketplaceBrowserProps) {
  const [blueprints, setBlueprints] = useState<MarketplaceBlueprint[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (category !== "all") params.set("category", category);

    fetch(`/api/marketplace/browse?${params}`)
      .then((r) => (r.ok ? r.json() : { blueprints: [], total: 0 }))
      .then((d) => {
        setBlueprints(d.blueprints ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => setBlueprints([]))
      .finally(() => setLoading(false));
  }, [page, category]);

  async function handleImport(blueprintId: string) {
    try {
      const res = await fetch("/api/marketplace/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId }),
      });
      if (res.ok) {
        toast.success("Blueprint imported! Check your workflows.");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Import failed");
      }
    } catch {
      toast.error("Failed to import blueprint");
    }
  }

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={category === cat ? "default" : "outline"}
            className="cursor-pointer capitalize"
            onClick={() => { setCategory(cat); setPage(1); }}
          >
            {cat}
          </Badge>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : blueprints.length === 0 ? (
        <EmptyState
          icon={Store}
          heading="No blueprints found"
          description={
            category !== "all"
              ? `No blueprints in the "${category}" category yet.`
              : "The marketplace is empty. Be the first to publish a blueprint!"
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {blueprints.map((bp) => (
            <BlueprintCard
              key={bp.id}
              blueprint={bp}
              canImport={canImport}
              onImport={handleImport}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground self-center">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page * 20 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
