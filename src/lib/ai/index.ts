import "server-only";

import { getGeminiEnv } from "@/lib/env";

import { createGeminiProvider } from "./gemini";
import type { LLMProvider } from "./provider";

let override: LLMProvider | null | undefined;

/** The configured provider, or null when no key is set (the pipeline then uses the default template). */
export function getLlmProvider(): LLMProvider | null {
  if (override !== undefined) return override;
  try {
    const env = getGeminiEnv();
    return createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
  } catch {
    return null;
  }
}

/** Test seam. Pass `undefined` to restore the real lookup. */
export function setLlmProviderForTests(provider: LLMProvider | null | undefined): void {
  override = provider;
}
