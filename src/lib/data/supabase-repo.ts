import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { INVITE_ASSET_BUCKET } from "@/lib/supabase/admin";
import { isGuestToken, isSlug } from "@/lib/token-format";

import { referencedAssetIds } from "./payload";
import { type Row, mapAsset, mapEvent, mapGuest, mapInvite, many, one } from "./supabase-rows";
import type {
  AssetContent,
  DbAsset,
  DbRsvp,
  InviteRepo,
  TokenLookup,
  UpsertRsvpArgs,
  UpsertRsvpResult,
} from "./types";

/** Public endpoints use the service role, so every query below is scoped by the verified token. */
export function createSupabaseRepo(admin: SupabaseClient): InviteRepo {
  async function findInviteRow(token: string): Promise<{ invite: Row; guest: Row | null } | null> {
    if (isGuestToken(token)) {
      const guest = one(
        await admin
          .from("guests")
          .select("id, invite_id, name, max_party_size, invited_event_ids")
          .eq("token", token)
          .maybeSingle(),
        "guest lookup",
      );
      if (guest) {
        const invite = one(
          await admin.from("invites").select("*").eq("id", guest.invite_id).maybeSingle(),
          "invite lookup",
        );
        return invite ? { invite, guest } : null;
      }
      const common = one(
        await admin.from("invites").select("*").eq("common_token", token).maybeSingle(),
        "common link lookup",
      );
      if (common) return { invite: common, guest: null };
    }
    if (isSlug(token)) {
      const bySlug = one(await admin.from("invites").select("*").eq("slug", token).maybeSingle(), "slug lookup");
      if (bySlug) return { invite: bySlug, guest: null };
    }
    return null;
  }

  return {
    async lookupToken(token): Promise<TokenLookup | null> {
      const found = await findInviteRow(token);
      if (!found || found.invite.status !== "published") return null;

      const inviteId = String(found.invite.id);
      const [eventsRes, paidRes, rsvpRes] = await Promise.all([
        admin.from("invite_events").select("*").eq("invite_id", inviteId).order("sort", { ascending: true }),
        admin.from("orders").select("id").eq("invite_id", inviteId).eq("status", "paid").limit(1),
        found.guest
          ? admin.from("rsvps").select("status, party_size, message").eq("guest_id", found.guest.id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      const events = many(eventsRes, "events").map(mapEvent);
      const paid = many(paidRes, "orders").length > 0;
      const rsvpRow = one(rsvpRes, "rsvp");

      const invite = mapInvite(found.invite, paid);
      const assetIds = referencedAssetIds(invite.spec);
      let assets: DbAsset[] = [];
      if (assetIds.length > 0) {
        const assetsRes = await admin.from("assets").select("*").eq("invite_id", inviteId).in("id", assetIds);
        assets = many(assetsRes, "assets").map(mapAsset);
      }

      const rsvp: DbRsvp | null = rsvpRow
        ? {
            status: rsvpRow.status as DbRsvp["status"],
            partySize: Number(rsvpRow.party_size),
            message: String(rsvpRow.message ?? ""),
          }
        : null;

      return { invite, guest: found.guest ? mapGuest(found.guest) : null, events, assets, rsvp };
    },

    async recordOpen(guestId) {
      const now = new Date().toISOString();
      await admin.from("guests").update({ last_opened_at: now }).eq("id", guestId);
      await admin.from("guests").update({ first_opened_at: now }).eq("id", guestId).is("first_opened_at", null);
    },

    async upsertRsvp({ token, idempotencyKey, submission }: UpsertRsvpArgs): Promise<UpsertRsvpResult> {
      // Atomic and idempotent: implemented as a SECURITY DEFINER function (see migrations).
      const { data, error } = await admin.rpc("upsert_rsvp", {
        p_token: token,
        p_key: idempotencyKey,
        p_status: submission.status,
        p_party_size: submission.partySize,
        p_message: submission.message,
        p_client_submitted_at: submission.clientSubmittedAt,
      });
      if (error) throw new Error(`rsvp upsert: ${error.message}`);
      switch (data) {
        case "created":
        case "updated":
        case "duplicate":
        case "stale":
          return { ok: true, outcome: data };
        case "invalid_party_size":
          return { ok: false, reason: "party_size" };
        default:
          return { ok: false, reason: "not_found" };
      }
    },

    async registerGuest({ inviteId, name, maxPartySize, cap }) {
      if (cap !== null) {
        const { count, error } = await admin.from("guests").select("id", { count: "exact", head: true }).eq("invite_id", inviteId);
        if (error) throw new Error(`guest count: ${error.message}`);
        if ((count ?? 0) >= cap) return "cap";
      }
      const created = one(
        await admin.from("guests").insert({ invite_id: inviteId, name, max_party_size: maxPartySize }).select("token").single(),
        "guest insert",
      );
      if (!created) throw new Error("guest insert returned nothing");
      return { token: String(created.token) };
    },

    async getAssetByToken(token, assetId): Promise<AssetContent | null> {
      const lookup = await this.lookupToken(token);
      if (!lookup) return null;
      const referenced = referencedAssetIds(lookup.invite.spec);
      const asset = lookup.assets.find((a) => a.id === assetId);
      if (!asset || !referenced.includes(assetId)) return null;

      const { data, error } = await admin.storage.from(INVITE_ASSET_BUCKET).download(asset.storagePath);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: asset.contentType };
    },

    async consumeRateLimit(key, windowSeconds, max) {
      const { data, error } = await admin.rpc("consume_rate_limit", {
        p_key: key,
        p_window_seconds: windowSeconds,
        p_max: max,
      });
      // Fail open: a limiter outage must not take down guest invitations.
      if (error) return true;
      return data === true;
    },
  };
}
