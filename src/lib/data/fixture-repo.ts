import { randomBytes, randomUUID } from "node:crypto";

import type { AiUsageEntry } from "@/lib/host/types";
import { isGuestToken, isSlug } from "@/lib/token-format";

import {
  createFixtureData,
  FIXTURE_IMAGE_BASE64,
  type FixtureGuest,
  type FixtureInvite,
  type FixtureOrder,
} from "./fixtures";
import type {
  AssetContent,
  DbRsvp,
  InviteRepo,
  TokenLookup,
  UpsertRsvpArgs,
  UpsertRsvpResult,
} from "./types";

export interface StoredRsvp extends DbRsvp {
  idempotencyKey: string;
  clientSubmittedAt: number;
  updatedAt: string;
}

export interface FixtureState {
  invites: FixtureInvite[];
  guests: FixtureGuest[];
  rsvps: Map<string, StoredRsvp>;
  opens: Map<string, number>;
  /** Uploaded asset bytes by asset id (stand-in for Supabase Storage). */
  assetBlobs: Map<string, AssetContent>;
  /** Stand-in for the orders table. */
  orders: FixtureOrder[];
  /** Stand-in for the ai_usage table. */
  aiUsage: (AiUsageEntry & { createdAt: string })[];
  rateLimits: Map<string, { windowStart: number; count: number }>;
  /** Every RSVP request that reached the server (including duplicates), for e2e assertions. */
  rsvpRequestLog: { guestId: string; idempotencyKey: string; outcome: string }[];
}

declare global {
  var __regaliaFixtureState: FixtureState | undefined;
}

/** Stored on globalThis so every route bundle in the same Node process shares one copy. */
export function getFixtureState(): FixtureState {
  if (!globalThis.__regaliaFixtureState) {
    globalThis.__regaliaFixtureState = {
      ...createFixtureData(),
      rsvps: new Map(),
      opens: new Map(),
      assetBlobs: new Map(),
      orders: [],
      aiUsage: [],
      rateLimits: new Map(),
      rsvpRequestLog: [],
    };
  }
  return globalThis.__regaliaFixtureState;
}

export function resetFixtureState(): void {
  globalThis.__regaliaFixtureState = undefined;
}

function decodeBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function createFixtureRepo(): InviteRepo {
  const state = () => getFixtureState();

  return {
    async lookupToken(token) {
      const s = state();
      let guest: FixtureGuest | undefined;
      let fixture: FixtureInvite | undefined;

      if (isGuestToken(token)) {
        guest = s.guests.find((g) => g.token === token);
        if (guest) fixture = s.invites.find((i) => i.invite.id === guest!.inviteId);
        else fixture = s.invites.find((i) => i.commonToken === token);
      }
      // A slug can also look like a token (long, lowercase): try it whenever nothing matched.
      if (!fixture && isSlug(token)) fixture = s.invites.find((i) => i.slug === token);

      if (!fixture || fixture.invite.status !== "published") return null;

      const rsvp = guest ? s.rsvps.get(guest.id) : undefined;
      const lookup: TokenLookup = {
        invite: fixture.invite,
        guest: guest
          ? { id: guest.id, name: guest.name, maxPartySize: guest.maxPartySize, invitedEventIds: guest.invitedEventIds }
          : null,
        events: fixture.events,
        assets: fixture.assets,
        rsvp: rsvp ? { status: rsvp.status, partySize: rsvp.partySize, message: rsvp.message } : null,
      };
      return lookup;
    },

    async recordOpen(guestId) {
      const s = state();
      s.opens.set(guestId, (s.opens.get(guestId) ?? 0) + 1);
      const guest = s.guests.find((g) => g.id === guestId);
      if (guest) {
        const now = new Date().toISOString();
        guest.firstOpenedAt ??= now;
        guest.lastOpenedAt = now;
      }
    },

    async upsertRsvp({ token, idempotencyKey, submission }: UpsertRsvpArgs): Promise<UpsertRsvpResult> {
      const s = state();
      const guest = s.guests.find((g) => g.token === token);
      const invite = guest && s.invites.find((i) => i.invite.id === guest.inviteId);
      if (!guest || !invite || invite.invite.status !== "published") return { ok: false, reason: "not_found" };
      if (submission.partySize > guest.maxPartySize) return { ok: false, reason: "party_size" };

      const clientSubmittedAt = new Date(submission.clientSubmittedAt).getTime();
      const existing = s.rsvps.get(guest.id);
      const log = (outcome: string) => s.rsvpRequestLog.push({ guestId: guest.id, idempotencyKey, outcome });

      if (!existing) {
        s.rsvps.set(guest.id, {
          status: submission.status,
          partySize: submission.partySize,
          message: submission.message,
          idempotencyKey,
          clientSubmittedAt,
          updatedAt: new Date().toISOString(),
        });
        log("created");
        return { ok: true, outcome: "created" };
      }
      if (existing.idempotencyKey === idempotencyKey) {
        log("duplicate");
        return { ok: true, outcome: "duplicate" };
      }
      if (existing.clientSubmittedAt >= clientSubmittedAt) {
        log("stale");
        return { ok: true, outcome: "stale" };
      }
      s.rsvps.set(guest.id, {
        status: submission.status,
        partySize: submission.partySize,
        message: submission.message,
        idempotencyKey,
        clientSubmittedAt,
        updatedAt: new Date().toISOString(),
      });
      log("updated");
      return { ok: true, outcome: "updated" };
    },

    async registerGuest({ inviteId, name, maxPartySize, cap }) {
      const s = state();
      if (cap !== null && s.guests.filter((g) => g.inviteId === inviteId).length >= cap) return "cap";
      const token = randomBytes(16).toString("base64url");
      s.guests.push({
        id: randomUUID(),
        name,
        maxPartySize,
        invitedEventIds: [],
        token,
        inviteId,
        phone: null,
        firstOpenedAt: null,
        lastOpenedAt: null,
        createdAt: new Date().toISOString(),
      });
      return { token };
    },

    async getAssetByToken(token, assetId): Promise<AssetContent | null> {
      const lookup = await this.lookupToken(token);
      if (!lookup) return null;
      const asset = lookup.assets.find((a) => a.id === assetId);
      const referenced =
        lookup.invite.spec.image?.assetId === assetId || lookup.invite.spec.music?.assetId === assetId;
      if (!asset || !referenced) return null;
      return state().assetBlobs.get(assetId) ?? { bytes: decodeBase64(FIXTURE_IMAGE_BASE64), contentType: asset.contentType };
    },

    async consumeRateLimit(key, windowSeconds, max) {
      const s = state();
      const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
      const entry = s.rateLimits.get(key);
      if (!entry || entry.windowStart !== windowStart) {
        s.rateLimits.set(key, { windowStart, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
  };
}
