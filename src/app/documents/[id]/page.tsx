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

  // Serialize Date timestamps and add relation placeholders for client component
  const initialDoc = {
    ...doc,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt),
    taskTitle: null as string | null,
    projectName: null as string | null,
  };

  return (
    <div className="gradient-forest-dawn min-h-screen p-6">
      <Link href="/documents">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Documents
        </Button>
      </Link>
      <DocumentDetailView documentId={id} initialDocument={initialDoc} />
    </div>
  );
}
