import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BlueprintEditor } from "@/components/workflows/blueprint-editor";

export const dynamic = "force-dynamic";

export default function NewBlueprintPage() {
  return (
    <div className="bg-background min-h-screen p-6">
      <Link href="/workflows/blueprints">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Blueprints
        </Button>
      </Link>
      <BlueprintEditor />
    </div>
  );
}
