"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Globe, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { EnvironmentScanRow, EnvironmentArtifactRow, EnvironmentCheckpointRow } from "@/lib/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanStatusBar } from "./scan-status-bar";
import { SummaryCardsRow } from "./summary-cards-row";
import { CategoryFilterBar } from "./category-filter-bar";
import { ArtifactCard } from "./artifact-card";
import { ArtifactDetailSheet } from "./artifact-detail-sheet";
import { CheckpointList } from "./checkpoint-list";

interface EnvironmentDashboardProps {
  scan: EnvironmentScanRow | null;
  artifacts: EnvironmentArtifactRow[];
  categoryCounts: Array<{ category: string; count: number }>;
  toolCounts: Array<{ tool: string; count: number }>;
  checkpoints?: EnvironmentCheckpointRow[];
}

export function EnvironmentDashboard({
  scan,
  artifacts,
  categoryCounts,
  toolCounts,
  checkpoints = [],
}: EnvironmentDashboardProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<EnvironmentArtifactRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [toolFilter, setToolFilter] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch("/api/environment/scan", { method: "POST" });
      router.refresh();
    } finally {
      setScanning(false);
    }
  }, [router]);

  // Filter artifacts client-side
  const filtered = artifacts.filter((a) => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (toolFilter && a.tool !== toolFilter) return false;
    if (scopeFilter && a.scope !== scopeFilter) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // No scan yet — show empty state with scan button
  if (!scan) {
    return (
      <EmptyState
        icon={Globe}
        heading="No environment scan yet"
        description="Scan your system to discover Claude Code and Codex CLI artifacts — skills, plugins, hooks, MCP servers, and more."
        action={
          <Button onClick={handleScan} disabled={scanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Scan Environment"}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <ScanStatusBar scan={scan} scanning={scanning} onScan={handleScan} />

      <SummaryCardsRow
        categoryCounts={categoryCounts}
        toolCounts={toolCounts}
        totalArtifacts={artifacts.length}
        onCategoryClick={(cat) =>
          setCategoryFilter(categoryFilter === cat ? null : cat)
        }
      />

      <Tabs defaultValue="artifacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="artifacts">Artifacts ({artifacts.length})</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints ({checkpoints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts" className="space-y-4">
          <CategoryFilterBar
            categoryCounts={categoryCounts}
            toolCounts={toolCounts}
            categoryFilter={categoryFilter}
            toolFilter={toolFilter}
            scopeFilter={scopeFilter}
            searchQuery={searchQuery}
            onCategoryChange={setCategoryFilter}
            onToolChange={setToolFilter}
            onScopeChange={setScopeFilter}
            onSearchChange={setSearchQuery}
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={Globe}
              heading="No artifacts match"
              description="Try adjusting your filters or search query."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onClick={() => setSelectedArtifact(artifact)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checkpoints">
          <CheckpointList checkpoints={checkpoints} />
        </TabsContent>
      </Tabs>

      <ArtifactDetailSheet
        artifact={selectedArtifact}
        open={!!selectedArtifact}
        onOpenChange={(open) => {
          if (!open) setSelectedArtifact(null);
        }}
      />
    </div>
  );
}
