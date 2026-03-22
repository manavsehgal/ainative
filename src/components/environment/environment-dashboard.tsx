"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, RefreshCw, GitCompareArrows, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { EnvironmentScanRow, EnvironmentArtifactRow, EnvironmentCheckpointRow, EnvironmentTemplateRow } from "@/lib/db/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanStatusBar } from "./scan-status-bar";
import { SummaryCardsRow } from "./summary-cards-row";
import { CategoryFilterBar } from "./category-filter-bar";
import { ArtifactCard } from "./artifact-card";
import { ArtifactDetailSheet } from "./artifact-detail-sheet";
import { CheckpointList } from "./checkpoint-list";
import { TemplateList } from "./template-list";
import { HealthScoreCard } from "./health-score-card";
import { SuggestedProfiles } from "./suggested-profiles";
import type { HealthScore } from "@/lib/environment/health-scoring";

interface EnvironmentDashboardProps {
  scan: EnvironmentScanRow | null;
  artifacts: EnvironmentArtifactRow[];
  categoryCounts: Array<{ category: string; count: number }>;
  toolCounts: Array<{ tool: string; count: number }>;
  checkpoints?: EnvironmentCheckpointRow[];
  templates?: EnvironmentTemplateRow[];
  healthScore?: HealthScore | null;
}

export function EnvironmentDashboard({
  scan,
  artifacts,
  categoryCounts,
  toolCounts,
  checkpoints = [],
  templates = [],
  healthScore,
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
      <div className="flex items-center justify-between">
        <ScanStatusBar scan={scan} scanning={scanning} onScan={handleScan} />
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <Link href="/environment/skills">
            <Button variant="outline" size="sm">
              <Wrench className="h-3.5 w-3.5 mr-1.5" />
              Skill Portfolio
            </Button>
          </Link>
          <Link href="/environment/compare">
            <Button variant="outline" size="sm">
              <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
              Compare
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <SummaryCardsRow
            categoryCounts={categoryCounts}
            toolCounts={toolCounts}
            totalArtifacts={artifacts.length}
            onCategoryClick={(cat) =>
              setCategoryFilter(categoryFilter === cat ? null : cat)
            }
          />
        </div>
        {healthScore && (
          <div className="w-[280px] shrink-0">
            <HealthScoreCard health={healthScore} />
          </div>
        )}
      </div>

      <Tabs defaultValue="artifacts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="artifacts">Artifacts ({artifacts.length})</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints ({checkpoints.length})</TabsTrigger>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
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

        <TabsContent value="templates">
          <TemplateList templates={templates} scanId={scan?.id} />
        </TabsContent>
      </Tabs>

      {/* Suggested profiles from environment artifacts */}
      <SuggestedProfiles scanId={scan?.id} />

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
