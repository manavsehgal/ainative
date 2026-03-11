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
    <div className="p-6">
      <Link href="/profiles">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Profiles
        </Button>
      </Link>
      <ProfileDetailView profileId={id} isBuiltin={isBuiltin(id)} />
    </div>
  );
}
