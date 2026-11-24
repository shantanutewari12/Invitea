import type { InvitePayload, PayloadAsset } from "@/lib/invite-payload";
import type { InviteEvent, InviteSpec } from "@/lib/spec/schema";

import type { DbEvent, TokenLookup } from "./types";

function toSpecEvent(event: DbEvent): InviteEvent {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    address: event.address,
    mapUrl: event.mapUrl,
  };
}

/** Asset ids that the spec actually references (hero image, music). */
export function referencedAssetIds(spec: InviteSpec): string[] {
  const ids: string[] = [];
  if (spec.image) ids.push(spec.image.assetId);
  if (spec.music) ids.push(spec.music.assetId);
  return ids;
}

/**
 * Build the minimal response for ONE token. This is a pure function over a
 * lookup that is already scoped to a single guest/invite, so by construction it
 * cannot include another guest's data. It deliberately omits the token itself,
 * owner ids, guest ids and anything about other guests.
 */
export function buildInvitePayload(lookup: TokenLookup, token: string): InvitePayload {
  const { invite, guest, events, assets, rsvp } = lookup;

  let visible = events;
  if (guest && guest.invitedEventIds.length > 0) {
    const allowed = new Set(guest.invitedEventIds);
    const filtered = events.filter((e) => allowed.has(e.id));
    if (filtered.length > 0) visible = filtered;
  }
  const specEvents = visible.length > 0 ? [...visible].sort((a, b) => a.sort - b.sort).map(toSpecEvent) : invite.spec.events;

  const referenced = new Set(referencedAssetIds(invite.spec));
  const payloadAssets: PayloadAsset[] = assets
    .filter((a) => referenced.has(a.id))
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      contentType: a.contentType,
      url: `/api/invites/by-token/${encodeURIComponent(token)}/assets/${a.id}`,
    }));

  return {
    payloadVersion: 1,
    invite: {
      id: invite.id,
      version: invite.version,
      displayMode: invite.displayMode,
      spec: { ...invite.spec, displayMode: invite.displayMode, events: specEvents },
      watermark: !invite.paid,
    },
    audience: guest
      ? {
          kind: "guest",
          guestName: guest.name,
          maxPartySize: guest.maxPartySize,
          rsvp: rsvp ? { status: rsvp.status, partySize: rsvp.partySize, message: rsvp.message } : null,
        }
      : { kind: "common" },
    assets: payloadAssets,
  };
}
