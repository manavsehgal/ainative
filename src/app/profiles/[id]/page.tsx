import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile, isBuiltin } from "@/lib/agents/profiles/registry";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfileDetailView } from "@/components/profiles/profile-detail-view";

export const dynamic = "force-dynamic";

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = getProfile(id);
  if (!profile) notFound();

  return (
    <div className="gradient-ocean-mist min-h-[100dvh] p-4 sm:p-6">
      <div className="surface-page mx-auto max-w-7xl rounded-[28px] border border-border/60 p-6 shadow-[0_18px_48px_oklch(0.12_0.02_260_/_0.08)]">
        <Link href="/profiles">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Profiles
          </Button>
        </Link>
        <ProfileDetailView profileId={id} isBuiltin={isBuiltin(id)} initialProfile={profile} />
      </div>
    </div>
  );
}
