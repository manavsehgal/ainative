import { getComparisonMatrix } from "@/lib/environment/comparison";
import { PageShell } from "@/components/shared/page-shell";
import { ComparisonMatrix } from "@/components/environment/comparison-matrix";

export const dynamic = "force-dynamic";

export default async function CompareProjectsPage() {
  const matrix = getComparisonMatrix();

  return (
    <PageShell
      title="Compare Projects"
      description="Environment artifacts across all onboarded projects"
      backHref="/environment"
      backLabel="Back to Environment"
    >
      <ComparisonMatrix matrix={matrix} />
    </PageShell>
  );
}
