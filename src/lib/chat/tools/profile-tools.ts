import { defineTool } from "../tool-registry";
import { z } from "zod";
import { ok, err, type ToolContext } from "./helpers";

export function profileTools(_ctx: ToolContext) {
  return [
    defineTool(
      "list_profiles",
      "List all available agent profiles with their capabilities and compatible runtimes.",
      {},
      async () => {
        try {
          const { listProfiles } = await import("@/lib/agents/profiles/registry");
          const profiles = listProfiles();
          return ok(
            profiles.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              domain: p.domain,
              tags: p.tags,
            }))
          );
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to list profiles");
        }
      }
    ),

    defineTool(
      "get_profile",
      "Get detailed configuration for a specific agent profile.",
      {
        profileId: z.string().describe("The profile ID to look up"),
      },
      async (args) => {
        try {
          const { getProfile } = await import("@/lib/agents/profiles/registry");
          const profile = getProfile(args.profileId);
          if (!profile) return err(`Profile not found: ${args.profileId}`);
          return ok(profile);
        } catch (e) {
          return err(e instanceof Error ? e.message : "Failed to get profile");
        }
      }
    ),
  ];
}
