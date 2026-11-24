import { AI_LIMITS } from "@/config/plans";
import { generateInviteSpec } from "@/lib/ai/generate";
import type { LLMProvider } from "@/lib/ai/provider";
import type { HostApiContext } from "@/lib/host/context";
import { generateInviteInputSchema } from "@/lib/spec/schema";
import { InvalidEventTimeError } from "@/lib/spec/defaults";

import { errorResponse, jsonResponse, readJson } from "./http";

const MAX_BODY_BYTES = 16 * 1024;

/** POST /api/ai/generate-invite. The model only styles; the host's own facts are never model output. */
export async function handleGenerateInvite(
  request: Request,
  ctx: HostApiContext,
  provider: LLMProvider | null,
): Promise<Response> {
  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const input = generateInviteInputSchema.safeParse(body.value);
  // Field names only (never values), so a bad form can be diagnosed.
  if (!input.success) return errorResponse(400, "invalid_input", { fields: input.error.issues.map((i) => i.path.join(".")) });

  const { user } = ctx;
  const hourOk = await ctx.limiter.consumeRateLimit(`ai:h:${user.id}`, 3600, AI_LIMITS.perHour);
  const dayOk = hourOk && (await ctx.limiter.consumeRateLimit(`ai:d:${user.id}`, 86400, AI_LIMITS.perDay));
  if (!hourOk || !dayOk) {
    const response = errorResponse(429, "rate_limited");
    response.headers.set("Retry-After", String(hourOk ? 86400 : 3600));
    return response;
  }

  const started = Date.now();
  try {
    const result = await generateInviteSpec(input.data, provider);
    await ctx.repo
      .logAiUsage({
        userId: user.id,
        inviteId: null,
        provider: provider?.name ?? "none",
        model: provider?.model ?? "none",
        outcome: result.outcome,
        promptChars: input.data.prompt.length,
        latencyMs: Date.now() - started,
      })
      .catch(() => undefined);
    return jsonResponse({ spec: result.spec, source: result.source, warnings: result.warnings });
  } catch (error) {
    if (error instanceof InvalidEventTimeError) {
      return errorResponse(422, "invalid_input", { field: "events", index: error.index });
    }
    return errorResponse(500, "server_error");
  }
}
