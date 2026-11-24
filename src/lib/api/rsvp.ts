import { MAX_PARTY_SIZE_DEFAULT, PLANS, RATE_LIMITS } from "@/config/plans";
import type { InviteRepo } from "@/lib/data/types";
import { guestNameSchema, rsvpSubmissionSchema } from "@/lib/spec/schema";
import { isGuestToken, isPlausibleInviteKey } from "@/lib/token-format";

import { errorResponse, jsonResponse, notFound, rateLimitByIp, readJson } from "./http";

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,100}$/;
const MAX_BODY_BYTES = 4 * 1024;

/**
 * POST /api/invites/by-token/[token]/rsvp
 *
 * Idempotent per guest. The client sends an `Idempotency-Key` (generated once per
 * RSVP and kept in the offline outbox), so retries after reconnecting, a Background
 * Sync replay and the `online`-event fallback can never create a second reply.
 */
export async function handleRsvp(request: Request, token: string, repo: InviteRepo): Promise<Response> {
  const limited = await rateLimitByIp(repo, "rsvp", request, RATE_LIMITS.rsvp);
  if (limited) return limited;

  // Only personal guest tokens can RSVP (the common link cannot).
  if (!isGuestToken(token)) return notFound();

  const key = request.headers.get("idempotency-key") ?? "";
  if (!IDEMPOTENCY_KEY.test(key)) return errorResponse(400, "invalid_input", { field: "idempotency-key" });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return errorResponse(413, "payload_too_large");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return errorResponse(400, "invalid_input");
  }
  const parsed = rsvpSubmissionSchema.safeParse(json);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  let result;
  try {
    result = await repo.upsertRsvp({ token, idempotencyKey: key, submission: parsed.data });
  } catch {
    return errorResponse(500, "server_error");
  }

  if (!result.ok) {
    return result.reason === "party_size" ? errorResponse(422, "invalid_input", { field: "partySize" }) : notFound();
  }
  // "duplicate" and "stale" are successes from the client's point of view: the outbox entry can be removed.
  return jsonResponse({ ok: true, outcome: result.outcome });
}

const commonReplySchema = rsvpSubmissionSchema
  .omit({ clientSubmittedAt: true })
  .extend({ name: guestNameSchema, partySize: rsvpSubmissionSchema.shape.partySize.max(MAX_PARTY_SIZE_DEFAULT) });

/**
 * POST /api/invites/by-token/[token]/respond
 *
 * Reply from the shared (common) link. The guest types their name; we add them to the host's
 * guest list (respecting the plan's guest cap) and record the reply, so it shows up in the
 * host's tracker like any other. Online only.
 */
export async function handleCommonRsvp(request: Request, token: string, repo: InviteRepo): Promise<Response> {
  const limited = await rateLimitByIp(repo, "rsvp-common", request, { windowSeconds: 600, max: 10 });
  if (limited) return limited;
  if (!isPlausibleInviteKey(token)) return notFound();

  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = commonReplySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");
  const { name, ...submission } = parsed.data;

  try {
    const lookup = await repo.lookupToken(token);
    if (!lookup || lookup.guest) return notFound();
    const plan = lookup.invite.paid ? PLANS.paid : PLANS.free;
    const guest = await repo.registerGuest({
      inviteId: lookup.invite.id,
      name,
      maxPartySize: MAX_PARTY_SIZE_DEFAULT,
      cap: plan.guestCap,
    });
    if (guest === "cap") return errorResponse(403, "plan_limit");
    const result = await repo.upsertRsvp({
      token: guest.token,
      idempotencyKey: crypto.randomUUID(),
      submission: { ...submission, clientSubmittedAt: new Date().toISOString() },
    });
    if (!result.ok) return errorResponse(500, "server_error");
    return jsonResponse({ ok: true });
  } catch {
    return errorResponse(500, "server_error");
  }
}
