// lib/llm.ts
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";

/**
 * ENV
 *   AI_PROVIDER=xai | openai   (default: xai)
 *   AI_MODEL=grok-3 | grok-4 | gpt-4o-mini ... (provider-specific; defaults below)
 *   XAI_API_KEY=...
 *   OPENAI_API_KEY=...
 */

type ProviderName = "xai" | "openai";

function getProvider(): ProviderName {
  const p = (process.env.AI_PROVIDER || "xai").toLowerCase();
  return p === "openai" ? "openai" : "xai";
}

// Return a model instance compatible with `generateText` / `streamText`
export function getTextModel() {
  const provider = getProvider();
  if (provider === "openai") {
    const name = process.env.AI_MODEL || "gpt-4o-mini";
    return openai(name);
  }
  // default to xAI (Grok)
  const name = process.env.AI_MODEL || "grok-3";
  return xai(name);
}

/** Optional provider knobs */
export function getProviderOptions():
  | { xai?: { searchParameters?: { mode?: "on" | "off" } } }
  | undefined {
  const provider = getProvider();
  if (provider === "xai") {
    // Keep Grok's live search off unless explicitly enabled
    return { xai: { searchParameters: { mode: "off" as const } } };
  }
  return undefined;
}
