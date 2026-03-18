import { notFound } from "next/navigation";
import { getDocBySlug, getManifest } from "@/lib/docs/reader";
import { getAdoptionMap } from "@/lib/docs/adoption";
import { PlaybookDetailView } from "@/components/playbook/playbook-detail-view";

export const dynamic = "force-dynamic";

interface PlaybookDetailProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PlaybookDetailProps) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  return {
    title: doc
      ? `${(doc.frontmatter.title as string) || slug} | Playbook | Stagent`
      : "Not Found | Playbook",
  };
}

export default async function PlaybookDetailPage({
  params,
}: PlaybookDetailProps) {
  const { slug } = await params;
  const [doc, manifest, adoptionMap] = await Promise.all([
    getDocBySlug(slug),
    getManifest(),
    getAdoptionMap(),
  ]);

  if (!doc) notFound();

  // Find related sections from manifest
  const allSections = [...manifest.sections, ...manifest.journeys];
  const currentSection = allSections.find((s) => s.slug === slug);

  // Find related docs by shared tags
  const currentTags = new Set(
    (currentSection && "tags" in currentSection
      ? (currentSection as { tags: string[] }).tags
      : (doc.frontmatter.tags as string[]) || []
    ).map((t) => t.toLowerCase())
  );

  const relatedSections = manifest.sections
    .filter(
      (s) =>
        s.slug !== slug &&
        s.tags.some((t) => currentTags.has(t.toLowerCase()))
    )
    .slice(0, 4);

  const adoption = Object.fromEntries(adoptionMap);

  // Collect all known doc slugs so markdown links resolve correctly
  const allSlugs = [
    ...manifest.sections.map((s) => s.slug),
    ...manifest.journeys.map((j) => j.slug),
    "getting-started",
    "index",
  ];

  return (
    <div className="gradient-twilight min-h-[100dvh] p-4 sm:p-6">
      <div className="surface-page rounded-[28px] border border-border/60 p-6 shadow-[0_18px_48px_oklch(0.12_0.02_260_/_0.08)]">
        <PlaybookDetailView
          doc={doc}
          relatedSections={relatedSections}
          adoption={adoption}
          allSlugs={allSlugs}
        />
      </div>
    </div>
  );
}
