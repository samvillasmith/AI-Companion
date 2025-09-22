// lib/llm.ts

export type ProviderName = "bedrock" | "openai" | "xai" | "google";
export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type Personality = "default" | "serious" | "creative";

const env = (k: string, d = "") => process.env[k] ?? d;

export const gatewayBase = () => env("GATEWAY_URL", "http://127.0.0.1:8000");

// ——— Models from ENV ———
const BEDROCK_MODEL_DEFAULT = env(
  "BEDROCK_MODEL_DEFAULT",
  "anthropic.claude-3-haiku-20240307-v1:0"  // Haiku as fallback
);

// Map categories to different providers and models
const CATEGORY_DEFAULTS: Record<string, { provider: ProviderName; model: string }> = {
  // Bedrock (Claude Haiku) for mentoring/professional
  Mentors: { 
    provider: "bedrock", 
    model: env("BEDROCK_MODEL_MENTORS", BEDROCK_MODEL_DEFAULT) 
  },
  Career: { 
    provider: "bedrock", 
    model: env("BEDROCK_MODEL_CAREER", BEDROCK_MODEL_DEFAULT) 
  },
  
  // OpenAI for technical/educational
  Technology: { 
    provider: "openai", 
    model: env("OPENAI_MODEL_TECH", "gpt-4o-mini") 
  },
  Sports: { 
    provider: "openai", 
    model: env("OPENAI_MODEL_SPORTS", "gpt-4o-mini") 
  },
  
  // Google Gemini for creative/entertainment
  "Movies & TV": { 
    provider: "google", 
    model: env("GOOGLE_MODEL_MOVIES", "gemini-1.5-flash") 
  },
  Music: { 
    provider: "google", 
    model: env("GOOGLE_MODEL_MUSIC", "gemini-1.5-flash") 
  },
  
  // xAI Grok for casual/fun
  Friends: { 
    provider: "xai", 
    model: env("XAI_MODEL_FRIENDS", "grok-2") 
  },
  Gaming: { 
    provider: "xai", 
    model: env("XAI_MODEL_GAMING", "grok-2") 
  },
  Travel: { 
    provider: "xai", 
    model: env("XAI_MODEL_TRAVEL", "grok-2") 
  },
  Spirituality: { 
    provider: "xai", 
    model: env("XAI_MODEL_SPIRITUAL", "grok-2") 
  },
  
  // Default fallback
  General: { 
    provider: "xai", 
    model: env("XAI_MODEL_DEFAULT", "grok-2") 
  },
};

export function parsePersonalityTag(seed?: string | null): Personality {
  const s = (seed || "").toLowerCase();
  if (/\bserious\b/.test(s)) return "serious";
  if (/\bcreative\b/.test(s)) return "creative";
  return "default";
}

export function getProviderAndModelForCompanion(
  category?: string | null,
  personality?: Personality | null
): { provider: ProviderName; modelName: string; providerOptions?: any } {
  const key = (category ?? "General").trim();
  
  // Get the category default or fall back to General
  const base = CATEGORY_DEFAULTS[key] ?? CATEGORY_DEFAULTS["General"];

  let provider = base.provider;
  let modelName = base.model;

  // Optional: Override based on personality
  if (personality === "serious" && provider !== "bedrock") {
    // For serious tone, prefer Claude or GPT-4
    provider = Math.random() > 0.5 ? "bedrock" : "openai";
    modelName = provider === "bedrock" 
      ? BEDROCK_MODEL_DEFAULT 
      : env("OPENAI_MODEL_SERIOUS", "gpt-4o-mini");
  } else if (personality === "creative") {
    // For creative, prefer Gemini or Grok
    provider = Math.random() > 0.5 ? "google" : "xai";
    modelName = provider === "google"
      ? env("GOOGLE_MODEL_CREATIVE", "gemini-1.5-flash")
      : env("XAI_MODEL_CREATIVE", "grok-2");
  }

  // Ensure we always have a model
  if (!modelName) {
    modelName = BEDROCK_MODEL_DEFAULT;
  }

  console.log(`[LLM] Category "${key}" → Provider: ${provider}, Model: ${modelName}`);

  return { provider, modelName, providerOptions: undefined };
}

// ——— Normalization for Bedrock Anthropic ———
// Guarantees: starts with user, strictly alternates, no `system` in array,
// folds all system text into the first user turn, and removes empties.
export function normalizeMessagesForProvider(
  provider: ProviderName,
  input: ChatMessage[]
): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const safe = input
    .map((m) => ({
      role: (m.role === "system" || m.role === "user" || m.role === "assistant"
        ? m.role
        : "user") as Role,
      content: (m.content ?? "").toString(),
    }))
    // drop fully empty messages early (we'll ensure a first user later)
    .filter((m) => m.content.trim().length > 0 || m.role === "system");

  if (provider !== "bedrock") return safe;

  // collect and strip system
  const sysParts: string[] = [];
  const uaOnly: ChatMessage[] = [];
  for (const m of safe) {
    if (m.role === "system") {
      if (m.content.trim()) sysParts.push(m.content.trim());
    } else {
      uaOnly.push({ role: m.role, content: m.content });
    }
  }

  // drop leading assistants
  while (uaOnly.length && uaOnly[0].role === "assistant") uaOnly.shift();

  // merge consecutive same-role
  const merged: ChatMessage[] = [];
  for (const m of uaOnly) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = (last.content ? last.content + "\n\n" : "") + m.content;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }

  // ensure first turn exists and is user
  if (!merged.length || merged[0].role !== "user") {
    merged.unshift({ role: "user", content: "" });
  }

  // fold system into first user
  const sys = sysParts.join("\n\n").trim();
  if (sys) {
    merged[0].content = (sys + (merged[0].content ? "\n\n" + merged[0].content : "")).trim();
  }

  // strict alternation pass
  const out: ChatMessage[] = [];
  for (const m of merged) {
    const last = out[out.length - 1];
    if (!last) {
      // force start user
      if (m.role !== "user") out.push({ role: "user", content: "" });
      if (m.role === "user") out.push({ role: "user", content: m.content });
      continue;
    }
    if (last.role === m.role) {
      // same role → merge into last
      last.content = (last.content ? last.content + "\n\n" : "") + m.content;
    } else {
      out.push(m);
    }
  }

  // remove accidental empties except the very first user (it can be just system text)
  return out.filter((m, i) => i === 0 || m.content.trim().length > 0);
}