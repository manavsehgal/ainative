"use client";

import { useEffect, useState, useMemo } from "react";
import { Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MyAppCard } from "./my-app-card";
import type { MyAppEntry, MyAppState } from "@/lib/apps/types";

const STATE_FILTERS: { label: string; value: MyAppState | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Installed", value: "installed" },
  { label: "Archived", value: "archived" },
  { label: "Failed", value: "failed" },
];

export function MyAppsPanel() {
  const [apps, setApps] = useState<MyAppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<MyAppState | "all">("all");
  const [search, setSearch] = useState("");

  function fetchApps() {
    setLoading(true);
    fetch("/api/apps/my")
      .then((r) => (r.ok ? r.json() : { apps: [] }))
      .then((d) => setApps(d.apps ?? []))
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchApps();
  }, []);

  const filtered = useMemo(() => {
    let result = apps;
    if (stateFilter !== "all") {
      result = result.filter((a) => a.state === stateFilter);
    }
    if (search.trim()) {
      const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
      result = result.filter((a) => {
        const haystack = `${a.name} ${a.description} ${a.tags.join(" ")}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }
    return result;
  }, [apps, stateFilter, search]);

  function handleRemoved(appId: string) {
    setApps((current) => current.filter((a) => a.appId !== appId));
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="surface-card-muted h-52 animate-pulse rounded-xl border"
          />
        ))}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <EmptyState
        icon={Package}
        heading="No custom apps yet"
        description="Export a project to create your first app package."
        action={
          <Button asChild variant="outline">
            <Link href="/projects">Browse Projects</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {STATE_FILTERS.map((f) => (
            <Badge
              key={f.value}
              variant={stateFilter === f.value ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setStateFilter(f.value)}
            >
              {f.label}
            </Badge>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 w-48 text-sm"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          heading="No matching apps"
          description="Try a different filter or search term."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((app) => (
            <MyAppCard
              key={app.appId}
              app={app}
              onRemoved={handleRemoved}
              onStateChange={fetchApps}
            />
          ))}
        </div>
      )}
    </div>
  );
}
