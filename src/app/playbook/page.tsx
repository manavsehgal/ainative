import { getManifest, getDocsLastGenerated } from "@/lib/docs/reader";
import { getUsageStage } from "@/lib/docs/usage-stage";
import { getAdoptionMap } from "@/lib/docs/adoption";
import { getJourneyCompletions } from "@/lib/docs/journey-tracker";
import { getSetting, setSetting } from "@/lib/settings/helpers";
import { PlaybookHomepage } from "@/components/playbook/playbook-homepage";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Playbook | Stagent",
};

export default async function PlaybookPage() {
  const [manifest, stage, adoptionMap, lastGenerated, lastVisit] =
    await Promise.all([
      getManifest(),
      getUsageStage(),
      getAdoptionMap(),
      getDocsLastGenerated(),
      getSetting("lastPlaybookVisit"),
    ]);

  const journeyCompletions = getJourneyCompletions(
    manifest.journeys,
    adoptionMap
  );

  // Update last visit timestamp
  await setSetting("lastPlaybookVisit", new Date().toISOString());

  // Serialize maps for client component
  const adoption = Object.fromEntries(adoptionMap);
  const completions = Object.fromEntries(journeyCompletions);

  const hasUpdates =
    lastGenerated != null &&
    lastVisit != null &&
    new Date(lastGenerated) > new Date(lastVisit);

  return (
    <div className="gradient-twilight min-h-[100dvh] p-4 sm:p-6">
      <div className="surface-page rounded-[28px] border border-border/60 p-6 shadow-[0_18px_48px_oklch(0.12_0.02_260_/_0.08)]">
        <PlaybookHomepage
          manifest={manifest}
          stage={stage}
          adoption={adoption}
          journeyCompletions={completions}
          hasUpdates={hasUpdates}
        />
      </div>
    </div>
  );
}
