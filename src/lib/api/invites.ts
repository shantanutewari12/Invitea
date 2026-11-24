import { randomUUID } from "node:crypto";

import { z } from "zod";

import { PLANS, RATE_LIMITS, UPLOAD_LIMITS } from "@/config/plans";
import { normalizePhone } from "@/lib/guests";
import type { HostApiContext } from "@/lib/host/context";
import type { AssetStorage } from "@/lib/host/storage";
import { finalizeSpec } from "@/lib/spec/finalize";
import { guestNameSchema, type InviteSpec } from "@/lib/spec/schema";
import { generateToken } from "@/lib/tokens";
import { SLUG_PATTERN } from "@/lib/token-format";

import { errorResponse, jsonResponse, notFound, readJson } from "./http";

const SPEC_BODY_BYTES = 80 * 1024;
const SMALL_BODY_BYTES = 32 * 1024;
const MAX_GUESTS_PER_REQUEST = 200;

// --- invites --------------------------------------------------------------------------------

const saveBodySchema = z.object({ spec: z.unknown() });

/**
 * Validate a spec for storage (sanitise, contrast fallback, schema), then assign server-side
 * event ids and check that referenced assets belong to this invite.
 */
export function prepareSpec(
  raw: unknown,
  existing: { eventIds: string[]; assetIds: Set<string> } | null,
): { ok: true; spec: InviteSpec; warnings: string[] } | { ok: false; error: string } {
  const result = finalizeSpec(raw);
  if (!result.ok) return result;
  const known = new Set(existing?.eventIds ?? []);
  const spec: InviteSpec = {
    ...result.spec,
    events: result.spec.events.map((event) => ({
      ...event,
      id: event.id && known.has(event.id) ? event.id : randomUUID(),
    })),
  };
  const assets = existing?.assetIds ?? new Set<string>();
  if (spec.image && !assets.has(spec.image.assetId)) return { ok: false, error: "image: unknown asset" };
  if (spec.music && !assets.has(spec.music.assetId)) return { ok: false, error: "music: unknown asset" };
  return { ok: true, spec, warnings: result.warnings };
}

export async function handleCreateInvite(request: Request, ctx: HostApiContext): Promise<Response> {
  const body = await readJson(request, SPEC_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = saveBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  const prepared = prepareSpec(parsed.data.spec, null);
  if (!prepared.ok) return errorResponse(400, "invalid_input", { detail: prepared.error });

  const invite = await ctx.repo.saveInvite(ctx.user.id, {
    id: null,
    eventType: prepared.spec.eventType,
    displayMode: prepared.spec.displayMode,
    spec: prepared.spec,
  });
  return invite ? jsonResponse({ invite }, { status: 201 }) : errorResponse(500, "server_error");
}

export async function handleUpdateInvite(request: Request, ctx: HostApiContext, inviteId: string): Promise<Response> {
  const body = await readJson(request, SPEC_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = saveBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  const current = await ctx.repo.getInvite(ctx.user.id, inviteId);
  if (!current) return notFound();

  const prepared = prepareSpec(parsed.data.spec, {
    eventIds: current.events.map((e) => e.id),
    assetIds: new Set(current.assets.map((a) => a.id)),
  });
  if (!prepared.ok) return errorResponse(400, "invalid_input", { detail: prepared.error });

  const invite = await ctx.repo.saveInvite(ctx.user.id, {
    id: inviteId,
    eventType: prepared.spec.eventType,
    displayMode: prepared.spec.displayMode,
    spec: prepared.spec,
  });
  return invite ? jsonResponse({ invite, warnings: prepared.warnings }) : notFound();
}

export async function handleDeleteInvite(ctx: HostApiContext, inviteId: string): Promise<Response> {
  const deleted = await ctx.repo.deleteInvite(ctx.user.id, inviteId);
  return deleted ? jsonResponse({ ok: true }) : notFound();
}

export async function handleSetStatus(request: Request, ctx: HostApiContext, inviteId: string): Promise<Response> {
  const body = await readJson(request, 1024);
  if (!body.ok) return body.response;
  const parsed = z.object({ status: z.enum(["draft", "published"]) }).safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");
  const invite = await ctx.repo.setStatus(ctx.user.id, inviteId, parsed.data.status);
  return invite ? jsonResponse({ invite }) : notFound();
}

export async function handleSetSlug(request: Request, ctx: HostApiContext, inviteId: string): Promise<Response> {
  const body = await readJson(request, 1024);
  if (!body.ok) return body.response;
  const parsed = z.object({ slug: z.string().regex(SLUG_PATTERN).nullable() }).safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  const invite = await ctx.repo.getInvite(ctx.user.id, inviteId);
  if (!invite) return notFound();
  if (!invite.paid || !PLANS.paid.customSlug) return errorResponse(403, "plan_limit", { feature: "custom_slug" });

  const result = await ctx.repo.setSlug(ctx.user.id, inviteId, parsed.data.slug);
  if (result === "taken") return errorResponse(409, "conflict");
  return result === "ok" ? jsonResponse({ slug: parsed.data.slug }) : notFound();
}

// --- guests ---------------------------------------------------------------------------------

const guestsBodySchema = z.object({
  guests: z
    .array(
      z.object({
        name: guestNameSchema,
        phone: z.string().max(30).nullish(),
        maxPartySize: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(MAX_GUESTS_PER_REQUEST),
});

export async function handleAddGuests(request: Request, ctx: HostApiContext, inviteId: string): Promise<Response> {
  const body = await readJson(request, SMALL_BODY_BYTES * 2);
  if (!body.ok) return body.response;
  const parsed = guestsBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  const drafts = [];
  for (const [index, guest] of parsed.data.guests.entries()) {
    const phone = guest.phone ? normalizePhone(guest.phone) : null;
    if (guest.phone && !phone) return errorResponse(400, "invalid_input", { field: "phone", index });
    drafts.push({ name: guest.name, phone, maxPartySize: guest.maxPartySize, token: generateToken() });
  }

  const invite = await ctx.repo.getInvite(ctx.user.id, inviteId);
  if (!invite) return notFound();
  const plan = invite.paid ? PLANS.paid : PLANS.free;
  const existing = (await ctx.repo.listGuests(ctx.user.id, inviteId)) ?? [];
  if (plan.guestCap !== null && existing.length + drafts.length > plan.guestCap) {
    return errorResponse(403, "plan_limit", { feature: "guests", cap: plan.guestCap, used: existing.length });
  }

  const created = await ctx.repo.addGuests(ctx.user.id, inviteId, drafts);
  return created ? jsonResponse({ guests: created }, { status: 201 }) : notFound();
}

export async function handleRemoveGuest(
  ctx: HostApiContext,
  inviteId: string,
  guestId: string,
): Promise<Response> {
  const removed = await ctx.repo.removeGuest(ctx.user.id, inviteId, guestId);
  return removed ? jsonResponse({ ok: true }) : notFound();
}

// --- assets ---------------------------------------------------------------------------------

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
};

const limitsFor = (kind: "image" | "audio") =>
  kind === "image"
    ? { types: UPLOAD_LIMITS.imageTypes, maxBytes: UPLOAD_LIMITS.imageMaxBytes }
    : { types: UPLOAD_LIMITS.audioTypes, maxBytes: UPLOAD_LIMITS.audioMaxBytes };

const signBodySchema = z.object({
  kind: z.enum(["image", "audio"]),
  contentType: z.string().max(60),
  bytes: z.number().int().positive(),
});

const assetPath = (ownerId: string, inviteId: string, assetId: string, contentType: string) =>
  `${ownerId}/${inviteId}/${assetId}.${EXTENSIONS[contentType] ?? "bin"}`;

/** Step 1: validate type and size, then hand out a signed upload target. */
export async function handleSignUpload(
  request: Request,
  ctx: HostApiContext,
  storage: AssetStorage,
  inviteId: string,
): Promise<Response> {
  const body = await readJson(request, 1024);
  if (!body.ok) return body.response;
  const parsed = signBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");
  const { kind, contentType, bytes } = parsed.data;

  const limits = limitsFor(kind);
  if (!limits.types.includes(contentType)) return errorResponse(400, "invalid_input", { field: "contentType" });
  if (bytes > limits.maxBytes) return errorResponse(413, "payload_too_large");

  const allowed = await ctx.limiter.consumeRateLimit(
    `upload:${ctx.user.id}`,
    RATE_LIMITS.upload.windowSeconds,
    RATE_LIMITS.upload.max,
  );
  if (!allowed) return errorResponse(429, "rate_limited");
  if (!(await ctx.repo.getInvite(ctx.user.id, inviteId))) return notFound();

  const assetId = randomUUID();
  const target = await storage.createUpload(assetPath(ctx.user.id, inviteId, assetId, contentType));
  return jsonResponse({ assetId, target });
}

/** Owner-only asset bytes for the builder preview (guests use the token-scoped route). */
export async function handleGetOwnAsset(
  ctx: HostApiContext,
  storage: AssetStorage,
  inviteId: string,
  assetId: string,
): Promise<Response> {
  const invite = await ctx.repo.getInvite(ctx.user.id, inviteId);
  const asset = invite?.assets.find((a) => a.id === assetId);
  if (!asset) return notFound();
  const content = await storage.download(asset.storagePath);
  if (!content) return notFound();
  return new Response(content.bytes as BodyInit, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

const confirmBodySchema = z.object({
  assetId: z.uuid(),
  kind: z.enum(["image", "audio"]),
  contentType: z.string().max(60),
});

/** Step 2: after the browser uploaded, check what is REALLY in storage before registering it. */
export async function handleConfirmUpload(
  request: Request,
  ctx: HostApiContext,
  storage: AssetStorage,
  inviteId: string,
): Promise<Response> {
  const body = await readJson(request, 1024);
  if (!body.ok) return body.response;
  const parsed = confirmBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");
  const { assetId, kind, contentType } = parsed.data;
  if (!(await ctx.repo.getInvite(ctx.user.id, inviteId))) return notFound();

  const path = assetPath(ctx.user.id, inviteId, assetId, contentType);
  const stat = await storage.stat(path);
  if (!stat) return errorResponse(400, "invalid_input", { field: "upload" });

  const limits = limitsFor(kind);
  if (!limits.types.includes(stat.contentType) || stat.bytes > limits.maxBytes) {
    await storage.remove(path);
    return errorResponse(400, "invalid_input", { field: "upload" });
  }

  const asset = await ctx.repo.registerAsset(ctx.user.id, inviteId, {
    id: assetId,
    kind,
    contentType: stat.contentType,
    storagePath: path,
    bytes: stat.bytes,
  });
  return asset ? jsonResponse({ asset }, { status: 201 }) : notFound();
}
