import { aggregateSkills } from "@/lib/environment/skill-portfolio";
import { PageShell } from "@/components/shared/page-shell";
import { SkillCatalog } from "@/components/environment/skill-catalog";

export const dynamic = "force-dynamic";

export default async function SkillPortfolioPage() {
  const skills = aggregateSkills();

  return (
    <PageShell
      title="Skill Portfolio"
      description={`${skills.length} unique skills across all projects and tools`}
      backHref="/environment"
      backLabel="Back to Environment"
    >
      <SkillCatalog skills={skills} />
    </PageShell>
  );
}
