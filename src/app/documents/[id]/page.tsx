import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageShell } from "@/components/shared/page-shell";
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
    <PageShell backHref="/documents" backLabel="Back to Documents" maxWidth="max-w-5xl">
      <DocumentDetailView documentId={id} initialDocument={initialDoc} />
    </PageShell>
  );
}
