import { listProfiles, isBuiltin } from "@/lib/agents/profiles/registry";
import { ProfileBrowser } from "@/components/profiles/profile-browser";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = listProfiles().map((p) => ({
    ...p,
    isBuiltin: isBuiltin(p.id),
  }));

  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <ProfileBrowser initialProfiles={profiles} />
    </div>
  );
}
