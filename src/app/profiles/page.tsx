import { listProfiles, isBuiltin } from "@/lib/agents/profiles/registry";
import { sortProfilesByName } from "@/lib/agents/profiles/sort";
import { ProfileBrowser } from "@/components/profiles/profile-browser";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = sortProfilesByName(
    listProfiles().map((p) => ({
      ...p,
      isBuiltin: isBuiltin(p.id),
    }))
  );

  return (
    <PageShell
      title="Profiles"
      description="Browse and inspect agent profiles without blur-heavy detail surfaces."
    >
      <ProfileBrowser initialProfiles={profiles} />
    </PageShell>
  );
}
