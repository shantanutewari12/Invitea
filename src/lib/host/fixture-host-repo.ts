import { randomUUID } from "node:crypto";

import { getFixtureState } from "@/lib/data/fixture-repo";
import type { FixtureGuest, FixtureInvite } from "@/lib/data/fixtures";
import type { DbEvent } from "@/lib/data/types";
import type { InviteSpec } from "@/lib/spec/schema";
import { generateToken } from "@/lib/tokens";

import { addReply, earliestStart, emptyCounts } from "./summary";
import type { HostGuest, HostInvite, HostOrder, HostRepo, InviteSummary, RsvpCounts } from "./types";

/**
 * In-memory HostRepo for fixture mode (REGALIA_E2E_FIXTURES=1) and unit tests. It shares state
 * with the fixture token repository, so an invite created here can be opened at its guest link.
 */
export function createFixtureHostRepo(): HostRepo {
  const state = () => getFixtureState();
  const now = () => new Date().toISOString();

  const owned = (ownerId: string, inviteId: string): FixtureInvite | undefined =>
    state().invites.find((i) => i.invite.id === inviteId && i.ownerId === ownerId);

  const isPaid = (f: FixtureInvite) =>
    f.invite.paid || state().orders.some((o) => o.inviteId === f.invite.id && o.status === "paid");

  function toHostInvite(f: FixtureInvite): HostInvite {
    return {
      ...f.invite,
      paid: isPaid(f),
      ownerId: f.ownerId,
      eventType: f.eventType,
      slug: f.slug,
      commonToken: f.commonToken ?? "",
      events: [...f.events].sort((a, b) => a.sort - b.sort),
      assets: [...f.assets],
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      publishedAt: f.publishedAt,
    };
  }

  function eventsFromSpec(spec: InviteSpec): DbEvent[] {
    return spec.events.map((event, index) => {
      if (!event.id) throw new Error("saveInvite requires every event to have an id");
      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        timezone: event.timezone,
        venueName: event.venueName,
        address: event.address,
        mapUrl: event.mapUrl,
        sort: index,
      };
    });
  }

  function guestsOf(inviteId: string): FixtureGuest[] {
    return state().guests.filter((g) => g.inviteId === inviteId);
  }

  function toHostGuest(g: FixtureGuest): HostGuest {
    const rsvp = state().rsvps.get(g.id);
    return {
      id: g.id,
      name: g.name,
      phone: g.phone,
      token: g.token,
      maxPartySize: g.maxPartySize,
      invitedEventIds: [...g.invitedEventIds],
      firstOpenedAt: g.firstOpenedAt,
      lastOpenedAt: g.lastOpenedAt,
      createdAt: g.createdAt,
      rsvp: rsvp
        ? { status: rsvp.status, partySize: rsvp.partySize, message: rsvp.message, updatedAt: rsvp.updatedAt }
        : null,
    };
  }

  function countRsvps(inviteId: string): RsvpCounts {
    const counts = emptyCounts();
    for (const guest of guestsOf(inviteId)) addReply(counts, state().rsvps.get(guest.id) ?? null);
    return counts;
  }

  const toOrder = (o: ReturnType<typeof state>["orders"][number]): HostOrder => ({ ...o });

  return {
    async listInvites(ownerId) {
      return state()
        .invites.filter((i) => i.ownerId === ownerId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map<InviteSummary>((f) => ({
          id: f.invite.id,
          status: f.invite.status,
          displayMode: f.invite.displayMode,
          eventType: f.eventType,
          headline: f.invite.spec.headline,
          hosts: f.invite.spec.hosts,
          firstEventAt: earliestStart(f.invite.spec),
          updatedAt: f.updatedAt,
          guestCount: guestsOf(f.invite.id).length,
          rsvp: countRsvps(f.invite.id),
          paid: isPaid(f),
        }));
    },

    async getInvite(ownerId, inviteId) {
      const f = owned(ownerId, inviteId);
      return f ? toHostInvite(f) : null;
    },

    async saveInvite(ownerId, input) {
      const s = state();
      const events = eventsFromSpec(input.spec);
      const stamp = now();

      if (input.id === null) {
        const id = randomUUID();
        const created: FixtureInvite = {
          invite: { id, status: "draft", version: 1, displayMode: input.displayMode, spec: input.spec, paid: false },
          ownerId,
          eventType: input.eventType,
          slug: null,
          commonToken: generateToken(),
          events,
          assets: [],
          createdAt: stamp,
          updatedAt: stamp,
          publishedAt: null,
        };
        s.invites.push(created);
        return toHostInvite(created);
      }

      const f = owned(ownerId, input.id);
      if (!f) return null;
      f.invite = { ...f.invite, displayMode: input.displayMode, spec: input.spec, version: f.invite.version + 1 };
      f.eventType = input.eventType;
      f.events = events;
      f.updatedAt = stamp;
      return toHostInvite(f);
    },

    async setStatus(ownerId, inviteId, status) {
      const f = owned(ownerId, inviteId);
      if (!f) return null;
      // No version bump: nothing a device may have cached changes by flipping the status.
      f.invite = { ...f.invite, status };
      if (status === "published") f.publishedAt ??= now();
      f.updatedAt = now();
      return toHostInvite(f);
    },

    async setSlug(ownerId, inviteId, slug) {
      const f = owned(ownerId, inviteId);
      if (!f) return "not_found";
      if (slug && state().invites.some((i) => i !== f && i.slug === slug)) return "taken";
      f.slug = slug;
      f.updatedAt = now();
      return "ok";
    },

    async listGuests(ownerId, inviteId) {
      if (!owned(ownerId, inviteId)) return null;
      return guestsOf(inviteId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name))
        .map(toHostGuest);
    },

    async addGuests(ownerId, inviteId, guests) {
      if (!owned(ownerId, inviteId)) return null;
      const created: FixtureGuest[] = guests.map((g) => ({
        id: randomUUID(),
        inviteId,
        token: g.token,
        name: g.name,
        phone: g.phone,
        maxPartySize: g.maxPartySize,
        invitedEventIds: [],
        firstOpenedAt: null,
        lastOpenedAt: null,
        createdAt: now(),
      }));
      state().guests.push(...created);
      return created.map(toHostGuest);
    },

    async removeGuest(ownerId, inviteId, guestId) {
      if (!owned(ownerId, inviteId)) return false;
      const s = state();
      const index = s.guests.findIndex((g) => g.id === guestId && g.inviteId === inviteId);
      if (index === -1) return false;
      s.guests.splice(index, 1);
      s.rsvps.delete(guestId);
      return true;
    },

    async deleteInvite(ownerId, inviteId) {
      if (!owned(ownerId, inviteId)) return false;
      const s = state();
      s.invites.splice(s.invites.findIndex((i) => i.invite.id === inviteId), 1);
      for (let i = s.guests.length - 1; i >= 0; i--) {
        const guest = s.guests[i]!;
        if (guest.inviteId !== inviteId) continue;
        s.rsvps.delete(guest.id);
        s.guests.splice(i, 1);
      }
      return true;
    },

    async registerAsset(ownerId, inviteId, asset) {
      const f = owned(ownerId, inviteId);
      if (!f) return null;
      const row = { id: asset.id, kind: asset.kind, contentType: asset.contentType, storagePath: asset.storagePath };
      f.assets.push(row);
      return row;
    },

    async logAiUsage(entry) {
      state().aiUsage.push({ ...entry, createdAt: now() });
    },

    async createOrder(ownerId, inviteId, order) {
      const f = owned(ownerId, inviteId);
      if (!f) return null;
      const row = {
        id: randomUUID(),
        inviteId,
        ownerId,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: null,
        amountMinor: order.amountMinor,
        currency: order.currency,
        status: "created" as const,
        createdAt: now(),
        paidAt: null,
      };
      state().orders.push(row);
      return toOrder(row);
    },

    async getOrderByRazorpayId(razorpayOrderId) {
      const order = state().orders.find((o) => o.razorpayOrderId === razorpayOrderId);
      return order ? toOrder(order) : null;
    },

    async markOrderPaid(razorpayOrderId, razorpayPaymentId) {
      const s = state();
      const order = s.orders.find((o) => o.razorpayOrderId === razorpayOrderId);
      if (!order) return null;
      // Replay of an already recorded payment (same order, or the same payment id anywhere).
      const duplicatePayment = s.orders.some((o) => o.razorpayPaymentId === razorpayPaymentId);
      if (order.status === "paid" || duplicatePayment) return { granted: false, order: toOrder(order) };
      order.status = "paid";
      order.razorpayPaymentId = razorpayPaymentId;
      order.paidAt = now();
      return { granted: true, order: toOrder(order) };
    },
  };
}
