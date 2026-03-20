import { BlueprintGallery } from "@/components/workflows/blueprint-gallery";

export const dynamic = "force-dynamic";

export default function BlueprintsPage() {
  return (
    <div className="bg-background min-h-screen p-6">
      <BlueprintGallery />
    </div>
  );
}
