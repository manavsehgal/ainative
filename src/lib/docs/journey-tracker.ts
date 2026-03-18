import type { AdoptionEntry, DocJourney, JourneyCompletion } from "./types";

/** Compute journey completion from adoption data */
export function getJourneyCompletions(
  journeys: DocJourney[],
  adoptionMap: Map<string, AdoptionEntry>
): Map<string, JourneyCompletion> {
  const completions = new Map<string, JourneyCompletion>();

  for (const journey of journeys) {
    const total = journey.sections.length;
    const completed = journey.sections.filter(
      (slug) => adoptionMap.get(slug)?.adopted === true
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    completions.set(journey.slug, { completed, total, percentage });
  }

  return completions;
}
