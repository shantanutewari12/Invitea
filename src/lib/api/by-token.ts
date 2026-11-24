import { RATE_LIMITS } from "@/config/plans";
import { buildInvitePayload } from "@/lib/data/payload";
import type { InviteRepo } from "@/lib/data/types";
import { isPlausibleInviteKey } from "@/lib/token-format";

import { errorResponse, etagFor, jsonResponse, notFound, rateLimitByIp } from "./http";

/**
 * GET /api/invites/by-token/[token]
 *
 * Returns the minimal payload for ONE token. Unknown tokens, malformed tokens
 * and unpublished invites all produce the same 404 so nothing can be enumerated.
 */
export async function handleTokenLookup(request: Request, token: string, repo: InviteRepo): Promise<Response> {
  const limited = await rateLimitByIp(repo, "token", request, RATE_LIMITS.tokenLookup);
  if (limited) return limited;

  if (!isPlausibleInviteKey(token)) return notFound();

  let lookup;
  try {
    lookup = await repo.lookupToken(token);
  } catch {
    return errorResponse(500, "server_error");
  }
  if (!lookup) return notFound();

  // Background revalidation from the viewer must not count as the guest "opening" the link again.
  const isRevalidation = new URL(request.url).searchParams.get("revalidate") === "1";
  if (lookup.guest && !isRevalidation) {
    try {
      await repo.recordOpen(lookup.guest.id);
    } catch {
      // Tracking is best effort; never fail the invitation because of it.
    }
  }

  const body = JSON.stringify(buildInvitePayload(lookup, token));
  const etag = etagFor(body);
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" },
    });
  }
  return jsonResponse(JSON.parse(body), { headers: { ETag: etag } });
}
