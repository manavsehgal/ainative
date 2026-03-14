import { notFound } from "next/navigation";
import Link from "next/link";
import { getProfile, isBuiltin } from "@/lib/agents/profiles/registry";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfileFormView } from "@/components/profiles/profile-form-view";

export const dynamic = "force-dynamic";

export default async function EditProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const { id } = await params;
  const { duplicate } = await searchParams;

  const profile = getProfile(id);
  if (!profile) notFound();

  // Builtins can't be edited, but can be duplicated
  if (isBuiltin(id) && duplicate !== "true") notFound();

  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <div className="">
        <Link href={duplicate === "true" ? "/profiles" : `/profiles/${id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {duplicate === "true" ? "Back to Profiles" : "Back to Profile"}
          </Button>
        </Link>
        <ProfileFormView profileId={id} duplicate={duplicate === "true"} />
      </div>
    </div>
  );
}
