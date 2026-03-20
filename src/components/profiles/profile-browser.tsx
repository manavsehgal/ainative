"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Bot, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfileCard } from "@/components/profiles/profile-card";
import { ProfileImportDialog } from "@/components/profiles/profile-import-dialog";
import type { AgentProfile } from "@/lib/agents/profiles/types";

interface ProfileWithBuiltin extends AgentProfile {
  isBuiltin?: boolean;
}

interface ProfileBrowserProps {
  initialProfiles: AgentProfile[];
}

export function ProfileBrowser({ initialProfiles }: ProfileBrowserProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<ProfileWithBuiltin[]>(initialProfiles);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<
    "all" | "work" | "personal"
  >("all");
  const [showImport, setShowImport] = useState(false);

  const filteredProfiles = useMemo(() => {
    const q = search.toLowerCase();
    return profiles.filter((p) => {
      if (domainFilter !== "all" && p.domain !== domainFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [profiles, search, domainFilter]);

  return (
    <div className="space-y-6">
      {/* Action buttons (title now provided by PageShell) */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowImport(true)}>
          <Download className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button onClick={() => router.push("/profiles/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Profile
        </Button>
      </div>

      {/* Search + Domain Filter */}
      <div className="surface-panel flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="surface-control pl-9"
          />
        </div>
        <Tabs
          value={domainFilter}
          onValueChange={(v) =>
            setDomainFilter(v as "all" | "work" | "personal")
          }
        >
          <TabsList className="surface-control">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grid */}
      <ProfileImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={() => router.refresh()}
      />

      {filteredProfiles.length === 0 ? (
        <EmptyState
          icon={Bot}
          heading="No profiles found"
          description="Try adjusting your search or filter, or create a new profile."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isBuiltin={profile.isBuiltin}
              onClick={() => router.push(`/profiles/${profile.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
