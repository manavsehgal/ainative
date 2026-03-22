"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Globe, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonaIndicator } from "./persona-indicator";

interface ScanSummary {
  scan: {
    id: string;
    artifactCount: number;
    persona: string;
    durationMs: number | null;
    scannedAt: string;
  } | null;
  summary?: {
    categoryCounts: Array<{ category: string; count: number }>;
    toolCounts: Array<{ tool: string; count: number }>;
  };
}

interface EnvironmentSummaryCardProps {
  projectId: string;
  workingDirectory?: string | null;
}

export function EnvironmentSummaryCard({
  projectId,
  workingDirectory,
}: EnvironmentSummaryCardProps) {
  const [data, setData] = useState<ScanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch(`/api/environment/scan?projectId=${projectId}`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleScan = async () => {
    if (!workingDirectory) return;
    setScanning(true);
    try {
      const res = await fetch("/api/environment/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectDir: workingDirectory, projectId }),
      });
      const json = await res.json();
      setData(json);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-16 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // No scan exists yet
  if (!data?.scan) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Environment not scanned</p>
              <p className="text-xs text-muted-foreground">
                Discover CLI artifacts for this project
              </p>
            </div>
          </div>
          {workingDirectory && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              disabled={scanning}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning..." : "Scan"}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const personas = (() => {
    try {
      return JSON.parse(data.scan.persona) as string[];
    } catch {
      return [];
    }
  })();

  const topCategories = (data.summary?.categoryCounts || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return (
    <Card className="elevation-1">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Environment
          </span>
          <Link href="/environment">
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              View <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {data.scan.artifactCount} artifacts
          </Badge>
          {personas.map((p) => (
            <PersonaIndicator key={p} tool={p} size="sm" />
          ))}
        </div>
        {topCategories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topCategories.map(({ category, count }) => (
              <Badge key={category} variant="secondary" className="text-[10px] px-1.5 py-0">
                {category}: {count}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
