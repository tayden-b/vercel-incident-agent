import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export interface ResolvedModel {
  model: LanguageModel;
  id: string;
}

// Provider is picked from whatever key is configured. AGENT_MODEL overrides
// the per-provider default so the whole pipeline can be pointed at a
// different model without code changes.
export function resolveModel(): ResolvedModel {
  const override = process.env.AGENT_MODEL;

  if (process.env.ANTHROPIC_API_KEY) {
    const id = override ?? "claude-haiku-4-5";
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return { model: anthropic(id), id };
  }

  if (process.env.OPENAI_API_KEY) {
    const id = override ?? "gpt-4o-mini";
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { model: openai(id), id };
  }

  throw new Error(
    "No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY (and optionally AGENT_MODEL).",
  );
}
