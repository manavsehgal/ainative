/**
 * Render a blueprint into a chat-ready first message.
 *
 * Pure template substitution over `blueprint.chatPrompt` with fallback to
 * `blueprint.steps[0].promptTemplate` for the 13 existing built-ins that
 * predate the `chatPrompt` field. Variable resolution is shared with the
 * workflow engine via `resolveTemplate` so behavior stays consistent.
 */

import type { WorkflowBlueprint } from "./types";
import { resolveTemplate } from "./template";

export interface RenderedBlueprintPrompt {
  /** The seed message to pre-fill into the chat composer. */
  firstMessage: string;
  /** The conversation title, with variable substitution applied. */
  title: string;
}

export interface RenderBlueprintPromptOptions {
  /**
   * Throw if any `{{token}}` references an undefined variable. Defaults to
   * false — the underlying `resolveTemplate` substitutes undefined values with
   * empty strings, which is the right behavior for optional blueprint vars.
   * Set to `true` to validate that all referenced tokens were resolved.
   */
  strict?: boolean;
}

export class UnresolvedTokenError extends Error {
  constructor(public readonly tokens: string[]) {
    super(`Unresolved template tokens: ${tokens.join(", ")}`);
    this.name = "UnresolvedTokenError";
  }
}

/**
 * Render a blueprint's chat prompt and title with the provided parameters.
 *
 * Falls back to `steps[0].promptTemplate` if `chatPrompt` is absent. If the
 * blueprint has no steps and no `chatPrompt`, returns an empty first message
 * (the picker UI is expected to validate this case upstream).
 */
export function renderBlueprintPrompt(
  blueprint: WorkflowBlueprint,
  params: Record<string, unknown>,
  options: RenderBlueprintPromptOptions = {}
): RenderedBlueprintPrompt {
  const source =
    blueprint.chatPrompt ?? blueprint.steps[0]?.promptTemplate ?? "";

  if (options.strict) {
    // Collect {{token}} names from the source (before resolveTemplate
    // substitutes undefined with empty string). Skip `#if`/`/if` directives.
    const unresolved = new Set<string>();
    for (const combined of [source, blueprint.name]) {
      const matches = combined.matchAll(/\{\{(\w+)\}\}/g);
      for (const m of matches) {
        if (!(m[1] in params)) unresolved.add(m[1]);
      }
    }
    if (unresolved.size > 0) {
      throw new UnresolvedTokenError([...unresolved]);
    }
  }

  const firstMessage = resolveTemplate(source, params);
  const title = resolveTemplate(blueprint.name, params);

  return { firstMessage, title };
}
