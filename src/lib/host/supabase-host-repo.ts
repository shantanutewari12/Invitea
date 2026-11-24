import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import { type Row, many, mapAsset, mapEvent, mapInvite, one } from "@/lib/data/supabase-rows";
import type { DbAsset } from "@/lib/data/types";

import { addReply, earliestStart, emptyCounts } from "./summary";
import type { HostGuest, HostInvite, HostOrder, HostRepo, InviteSummary } from "./types";

const UNIQUE_VIOLATION = "23505";

const mapOrder = (row: Row): HostOrder => ({
  id: String(row.id),
  inviteId: String(row.invite_id),
  ownerId: String(row.owner_id),
  razorpayOrderId: String(row.razorpay_order_id),
  razorpayPaymentId: row.razorpay_payment_id ? String(row.razorpay_payment_id) : null,
  amountMinor: Number(row.amount_minor),
  currency: String(row.currency),
  status: row.status === "paid" ? "paid" : row.status === "failed" ? "failed" : "created",
  createdAt: new Date(String(row.created_at)).toISOString(),
  paidAt: row.paid_at ? new Date(String(row.paid_at)).toISOString() : null,
});

function mapHostGuest(row: Row, rsvp: Row | null): HostGuest {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    token: String(row.token),
    maxPartySize: Number(row.max_party_size),
    invitedEventIds: Array.isArray(row.invited_event_ids) ? (row.invited_event_ids as string[]) : [],
    firstOpenedAt: row.first_opened_at ? new Date(String(row.first_opened_at)).toISOString() : null,
    lastOpenedAt: row.last_opened_at ? new Date(String(row.last_opened_at)).toISOString() : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    rsvp: rsvp
      ? {
          status: rsvp.status as "yes" | "no" | "maybe",
          partySize: Number(rsvp.party_size),
          message: String(rsvp.message ?? ""),
          updatedAt: new Date(String(rsvp.updated_at)).toISOString(),
        }
      : null,
  };
}

/**
 * Host data access on Supabase.
 *
 * - `reader` is the signed-in host's own client: reads go through RLS, so even a forgotten
 *   owner filter cannot return another host's rows (defence in depth; the filters are there too).
 * - `admin` is the service role: hosts have no write grants, so every write is made here, after
 *   an explicit ownership check, with input the route handler already validated.
 * Payment webhooks have no user; they construct this with `reader === admin`.
 */
export function createSupabaseHostRepo(deps: { admin: SupabaseClient; reader: SupabaseClient }): HostRepo {
  const { admin, reader } = deps;

  async function ownsInvite(client: SupabaseClient, ownerId: string, inviteId: string): Promise<boolean> {
    const row = one(
      await client.from("invites").select("id").eq("id", inviteId).eq("owner_id", ownerId).maybeSingle(),
      "ownership check",
    );
    return row !== null;
  }

  async function paidInviteIds(client: SupabaseClient, inviteIds: string[]): Promise<Set<string>> {
    if (inviteIds.length === 0) return new Set();
    const rows = many(
      await client.from("orders").select("invite_id").eq("status", "paid").in("invite_id", inviteIds),
      "paid orders",
    );
    return new Set(rows.map((r) => String(r.invite_id)));
  }

  const repo: HostRepo = {
    async listInvites(ownerId) {
      const inviteRows = many(
        await reader.from("invites").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false }),
        "invites",
      );
      const ids = inviteRows.map((r) => String(r.id));
      if (ids.length === 0) return [];

      const [guestRows, rsvpRows, paid] = await Promise.all([
        reader.from("guests").select("id, invite_id").in("invite_id", ids).then((r) => many(r, "guests")),
        reader.from("rsvps").select("guest_id, invite_id, status, party_size").in("invite_id", ids).then((r) => many(r, "rsvps")),
        paidInviteIds(reader, ids),
      ]);

      const replies = new Map(rsvpRows.map((r) => [String(r.guest_id), r]));
      return inviteRows.map<InviteSummary>((row) => {
        const id = String(row.id);
        const invite = mapInvite(row, paid.has(id));
        const rsvp = emptyCounts();
        let guestCount = 0;
        for (const guest of guestRows) {
          if (String(guest.invite_id) !== id) continue;
          guestCount += 1;
          const reply = replies.get(String(guest.id));
          addReply(rsvp, reply ? { status: reply.status as "yes" | "no" | "maybe", partySize: Number(reply.party_size) } : null);
        }
        return {
          id,
          status: invite.status,
          displayMode: invite.displayMode,
          eventType: row.event_type as InviteSummary["eventType"],
          headline: invite.spec.headline,
          hosts: invite.spec.hosts,
          firstEventAt: earliestStart(invite.spec),
          updatedAt: new Date(String(row.updated_at)).toISOString(),
          guestCount,
          rsvp,
          paid: invite.paid,
        };
      });
    },

    async getInvite(ownerId, inviteId): Promise<HostInvite | null> {
      const row = one(
        await reader.from("invites").select("*").eq("id", inviteId).eq("owner_id", ownerId).maybeSingle(),
        "invite",
      );
      if (!row) return null;
      const [eventRows, assetRows, paid] = await Promise.all([
        reader.from("invite_events").select("*").eq("invite_id", inviteId).order("sort", { ascending: true }).then((r) => many(r, "events")),
        reader.from("assets").select("*").eq("invite_id", inviteId).then((r) => many(r, "assets")),
        paidInviteIds(reader, [inviteId]),
      ]);
      return {
        ...mapInvite(row, paid.has(inviteId)),
        ownerId: String(row.owner_id),
        eventType: row.event_type as HostInvite["eventType"],
        slug: row.slug ? String(row.slug) : null,
        commonToken: String(row.common_token),
        events: eventRows.map(mapEvent),
        assets: assetRows.map(mapAsset),
        createdAt: new Date(String(row.created_at)).toISOString(),
        updatedAt: new Date(String(row.updated_at)).toISOString(),
        publishedAt: row.published_at ? new Date(String(row.published_at)).toISOString() : null,
      };
    },

    async saveInvite(ownerId, input) {
      const { data, error } = await admin.rpc("save_invite", {
        p_owner: ownerId,
        p_invite_id: input.id,
        p_event_type: input.eventType,
        p_display_mode: input.displayMode,
        p_spec: input.spec,
      });
      if (error) throw new Error(`save invite: ${error.message}`);
      if (typeof data !== "string") return null;
      return repo.getInvite(ownerId, data);
    },

    async setStatus(ownerId, inviteId, status) {
      const updated = many(
        await admin.from("invites").update({ status }).eq("id", inviteId).eq("owner_id", ownerId).select("id"),
        "set status",
      );
      if (updated.length === 0) return null;
      if (status === "published") {
        await admin
          .from("invites")
          .update({ published_at: new Date().toISOString() })
          .eq("id", inviteId)
          .is("published_at", null);
      }
      return repo.getInvite(ownerId, inviteId);
    },

    async setSlug(ownerId, inviteId, slug) {
      const result = await admin
        .from("invites")
        .update({ slug })
        .eq("id", inviteId)
        .eq("owner_id", ownerId)
        .select("id");
      if (result.error) {
        if (result.error.code === UNIQUE_VIOLATION) return "taken";
        throw new Error(`set slug: ${result.error.message}`);
      }
      return result.data.length === 0 ? "not_found" : "ok";
    },

    async listGuests(ownerId, inviteId) {
      if (!(await ownsInvite(reader, ownerId, inviteId))) return null;
      const [guestRows, rsvpRows] = await Promise.all([
        reader.from("guests").select("*").eq("invite_id", inviteId).order("created_at").order("name").then((r) => many(r, "guests")),
        reader.from("rsvps").select("*").eq("invite_id", inviteId).then((r) => many(r, "rsvps")),
      ]);
      const replies = new Map(rsvpRows.map((r) => [String(r.guest_id), r]));
      return guestRows.map((g) => mapHostGuest(g, replies.get(String(g.id)) ?? null));
    },

    async addGuests(ownerId, inviteId, guests) {
      if (!(await ownsInvite(admin, ownerId, inviteId))) return null;
      if (guests.length === 0) return [];
      const rows = many(
        await admin
          .from("guests")
          .insert(
            guests.map((g) => ({
              invite_id: inviteId,
              name: g.name,
              phone: g.phone,
              token: g.token,
              max_party_size: g.maxPartySize,
            })),
          )
          .select("*"),
        "add guests",
      );
      return rows.map((r) => mapHostGuest(r, null));
    },

    async removeGuest(ownerId, inviteId, guestId) {
      if (!(await ownsInvite(admin, ownerId, inviteId))) return false;
      const removed = many(
        await admin.from("guests").delete().eq("id", guestId).eq("invite_id", inviteId).select("id"),
        "remove guest",
      );
      return removed.length > 0;
    },

    async deleteInvite(ownerId, inviteId) {
      if (!(await ownsInvite(admin, ownerId, inviteId))) return false;
      const files = many(await admin.from("assets").select("storage_path").eq("invite_id", inviteId), "list assets");
      many(await admin.from("invites").delete().eq("id", inviteId).eq("owner_id", ownerId).select("id"), "delete invite");
      const paths = files.map((f) => String(f.storage_path));
      if (paths.length > 0) {
        try {
          await admin.storage.from("invite-assets").remove(paths);
        } catch {
          // Orphaned files are harmless; the invite itself is gone.
        }
      }
      return true;
    },

    async registerAsset(ownerId, inviteId, asset): Promise<DbAsset | null> {
      if (!(await ownsInvite(admin, ownerId, inviteId))) return null;
      const row = one(
        await admin
          .from("assets")
          .insert({
            id: asset.id,
            invite_id: inviteId,
            owner_id: ownerId,
            kind: asset.kind,
            content_type: asset.contentType,
            storage_path: asset.storagePath,
            bytes: asset.bytes,
          })
          .select("*")
          .single(),
        "register asset",
      );
      return row ? mapAsset(row) : null;
    },

    async logAiUsage(entry) {
      // Usage logging must never fail the request that triggered it.
      await admin.from("ai_usage").insert({
        user_id: entry.userId,
        invite_id: entry.inviteId,
        provider: entry.provider,
        model: entry.model,
        outcome: entry.outcome,
        prompt_chars: entry.promptChars,
        latency_ms: entry.latencyMs,
      });
    },

    async createOrder(ownerId, inviteId, order) {
      if (!(await ownsInvite(admin, ownerId, inviteId))) return null;
      const row = one(
        await admin
          .from("orders")
          .insert({
            invite_id: inviteId,
            owner_id: ownerId,
            razorpay_order_id: order.razorpayOrderId,
            amount_minor: order.amountMinor,
            currency: order.currency,
          })
          .select("*")
          .single(),
        "create order",
      );
      return row ? mapOrder(row) : null;
    },

    async getOrderByRazorpayId(razorpayOrderId) {
      const row = one(
        await admin.from("orders").select("*").eq("razorpay_order_id", razorpayOrderId).maybeSingle(),
        "order lookup",
      );
      return row ? mapOrder(row) : null;
    },

    async markOrderPaid(razorpayOrderId, razorpayPaymentId) {
      // The status guard makes the grant atomic: of any number of concurrent or replayed calls,
      // exactly one matches `status <> 'paid'`. The unique payment id is a second backstop.
      const result = await admin
        .from("orders")
        .update({ status: "paid", razorpay_payment_id: razorpayPaymentId, paid_at: new Date().toISOString() })
        .eq("razorpay_order_id", razorpayOrderId)
        .neq("status", "paid")
        .select("*");

      if (result.error && result.error.code !== UNIQUE_VIOLATION) {
        throw new Error(`mark order paid: ${result.error.message}`);
      }
      if (!result.error && result.data.length > 0) {
        return { granted: true, order: mapOrder(result.data[0] as Row) };
      }
      const existing = await repo.getOrderByRazorpayId(razorpayOrderId);
      return existing ? { granted: false, order: existing } : null;
    },
  };

  return repo;
}
