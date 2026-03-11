import { listProfiles, isBuiltin } from "@/lib/agents/profiles/registry";
import { ProfileBrowser } from "@/components/profiles/profile-browser";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  const profiles = listProfiles().map((p) => ({
    ...p,
    isBuiltin: isBuiltin(p.id),
  }));

  return (
    <div className="gradient-ocean-mist min-h-[100dvh] p-4 sm:p-6">
      <div className="surface-page mx-auto max-w-7xl rounded-[28px] border border-border/60 p-6 shadow-[0_18px_48px_oklch(0.12_0.02_260_/_0.08)]">
        <ProfileBrowser initialProfiles={profiles} />
      </div>
    </div>
  );
}
