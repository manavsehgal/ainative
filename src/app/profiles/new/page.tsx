import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfileFormView } from "@/components/profiles/profile-form-view";

export const dynamic = "force-dynamic";

export default async function NewProfilePage() {
  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <div className="">
        <Link href="/profiles">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Profiles
          </Button>
        </Link>
        <ProfileFormView />
      </div>
    </div>
  );
}
