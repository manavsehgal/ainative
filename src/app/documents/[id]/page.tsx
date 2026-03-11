import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DocumentDetailView } from "@/components/documents/document-detail-view";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id));

  if (!doc) notFound();

  return (
    <div className="p-6">
      <Link href="/documents">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Documents
        </Button>
      </Link>
      <DocumentDetailView documentId={id} />
    </div>
  );
}
