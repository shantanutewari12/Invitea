import { RATE_LIMITS } from "@/config/plans";
import type { InviteRepo } from "@/lib/data/types";
import { isPlausibleInviteKey } from "@/lib/token-format";

import { errorResponse, notFound, rateLimitByIp } from "./http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SERVABLE = /^(image\/(webp|png|jpeg)|audio\/(mpeg|mp4|aac|ogg))$/;

/**
 * GET /api/invites/by-token/[token]/assets/[assetId]
 *
 * Streams one asset, but only if it belongs to the invite behind this token and
 * is referenced by it. Assets stay in a private bucket; the browser copies them
 * into IndexedDB so the invite works offline.
 */
export async function handleAssetFetch(
  request: Request,
  token: string,
  assetId: string,
  repo: InviteRepo,
): Promise<Response> {
  const limited = await rateLimitByIp(repo, "asset", request, RATE_LIMITS.assets);
  if (limited) return limited;

  if (!isPlausibleInviteKey(token) || !UUID.test(assetId)) return notFound();

  let content;
  try {
    content = await repo.getAssetByToken(token, assetId);
  } catch {
    return errorResponse(500, "server_error");
  }
  if (!content || !SERVABLE.test(content.contentType)) return notFound();

  // Copy into a fresh ArrayBuffer-backed view so the body type is unambiguous.
  const body = new Uint8Array(content.bytes);
  return new Response(body, {
    headers: {
      "Content-Type": content.contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
