import type { AgentProfile } from "./types";
import { generalProfile } from "./general";
import { codeReviewerProfile } from "./code-reviewer";
import { researcherProfile } from "./researcher";
import { documentWriterProfile } from "./document-writer";

const profiles = new Map<string, AgentProfile>();

for (const profile of [
  generalProfile,
  codeReviewerProfile,
  researcherProfile,
  documentWriterProfile,
]) {
  profiles.set(profile.id, profile);
}

export function getProfile(id: string): AgentProfile | undefined {
  return profiles.get(id);
}

export function listProfiles(): AgentProfile[] {
  return Array.from(profiles.values());
}

export function getProfileTags(): Map<string, string[]> {
  const tagMap = new Map<string, string[]>();
  for (const profile of profiles.values()) {
    tagMap.set(profile.id, profile.tags);
  }
  return tagMap;
}
