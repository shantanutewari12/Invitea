import type { LLMProvider } from "./provider";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/** Gemini over its REST API (no SDK, so it is trivial to mock). Server-side only. */
export function createGeminiProvider(
  config: { apiKey: string; model: string },
  fetchImpl: typeof fetch = fetch,
): LLMProvider {
  return {
    name: "gemini",
    model: config.model,
    async generateJson({ system, user, jsonSchema, signal }) {
      const response = await fetchImpl(`${ENDPOINT}/${encodeURIComponent(config.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            temperature: 0.8,
            maxOutputTokens: 1024,
          },
        }),
        signal,
      });
      if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
      const data = (await response.json()) as GeminiResponse;
      return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    },
  };
}
