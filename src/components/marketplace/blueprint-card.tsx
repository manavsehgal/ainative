"use client";

import { Download, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketplaceBlueprint } from "@/lib/marketplace/marketplace-client";

interface BlueprintCardProps {
  blueprint: MarketplaceBlueprint;
  canImport: boolean;
  onImport?: (id: string) => void;
}

export function BlueprintCard({ blueprint, canImport, onImport }: BlueprintCardProps) {
  return (
    <div className="surface-card-muted rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{blueprint.title}</h3>
          {blueprint.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {blueprint.description}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0">
          {blueprint.category}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {blueprint.install_count}
          </span>
          {blueprint.success_rate > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {Math.round(blueprint.success_rate * 100)}%
            </span>
          )}
          {blueprint.tags?.length > 0 && (
            <span>{blueprint.tags.slice(0, 2).join(", ")}</span>
          )}
        </div>

        {canImport && onImport && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onImport(blueprint.id)}
          >
            <Download className="h-3 w-3 mr-1" />
            Import
          </Button>
        )}
      </div>
    </div>
  );
}
