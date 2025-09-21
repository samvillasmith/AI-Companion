// lib/llm.ts
import type { CoreModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";

/**
 * ENV
 *   AI_PROVIDER=xai | openai   (default: xai)
 *   AI_MODEL=grok-3 | grok-4 | gpt-4o-mini ... (provider-specific; defaults below)
 *   XAI_API_KEY=...
 *   OPENAI_API_KEY=...
 *
 * Note: The AI SDK providers read keys from env automatically.
 */

type ProviderName = "xai" | "openai";

function getProvider(): ProviderName {
  const p = (process.env.AI_PROVIDER || "xai").toLowerCase();
  return p === "openai" ? "openai" : "xai";
}

export function getTextModel(): CoreModel {
  const provider = getProvider();
  if (provider === "openai") {
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    return openai(model);
  }
  // default to xAI (Grok)
  const model = process.env.AI_MODEL || "grok-3";
  return xai(model);
}

/** Optional provider knobs */
export function getProviderOptions():
  | { xai?: { searchParameters?: { mode?: "on" | "off" } } }
  | undefined {
  const provider = getProvider();
  if (provider === "xai") {
    // Keep Grok from doing live web search unless you explicitly enable it
    return { xai: { searchParameters: { mode: "off" } } };
  }
  return undefined;
}
