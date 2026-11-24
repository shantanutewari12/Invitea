import type { EventType } from "@/lib/spec/constants";
import { buildDefaultStyle, buildInviteSpec } from "@/lib/spec/defaults";
import type { GenerateInviteInput, InviteSpec } from "@/lib/spec/schema";

import type { DbAsset, DbEvent, DbGuest, DbInvite } from "./types";

/**
 * In-memory data used ONLY when REGALIA_E2E_FIXTURES=1 (Playwright runs and local
 * demos without Supabase). It mirrors the shape of the real tables, including two
 * guests on the same invite so isolation between tokens can be tested end to end.
 * Both the public (token) repository and the host repository read and write this state.
 */

/** The signed-in host of every fixture invite (fake sign-in, fixture mode only). */
export const FIXTURE_USER = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", email: "demo@regalia.test" } as const;

export const FIXTURE_TOKENS = {
  alice: "fx_alice_Wc9Qm2Zp4Rt8Xk",
  bob: "fx_bob_Hn3Vd7Ls5Yb1Jq0",
  carol: "fx_carol_Pz4Ku8Ta1Mv6Ex",
  common: "fx_common_Ek6Ts0Gu8Nf2Aw",
  unpublished: "fx_draft_Qb7Lm3Ny9Rc5Dh",
} as const;

export const FIXTURE_IDS = {
  animatedInvite: "11111111-1111-4111-8111-111111111111",
  staticInvite: "22222222-2222-4222-8222-222222222222",
  draftInvite: "33333333-3333-4333-8333-333333333333",
  weddingEvent: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  receptionEvent: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  staticEvent: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  heroImage: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
} as const;

/** A valid 1x1 WebP (used as the fixture hero image). */
export const FIXTURE_IMAGE_BASE64 = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

function input(displayMode: "animated" | "static", staticDate: boolean): GenerateInviteInput {
  return {
    eventType: "wedding",
    prompt: "",
    hosts: ["Aarav", "Meera"],
    displayMode,
    events: staticDate
      ? [
          {
            title: "Wedding Ceremony",
            startsAtLocal: "2030-03-01T11:00",
            timezone: "Asia/Kolkata",
            venueName: "Lake View Gardens",
            address: "4 Lake Road, Udaipur, Rajasthan",
            mapUrl: "",
          },
        ]
      : [
          {
            title: "Wedding Ceremony",
            startsAtLocal: "2030-02-14T18:30",
            timezone: "Asia/Kolkata",
            venueName: "Umaid Palace",
            address: "12 Palace Road, Jodhpur, Rajasthan",
            mapUrl: "https://maps.google.com/?q=Umaid+Palace+Jodhpur",
          },
          {
            title: "Reception",
            startsAtLocal: "2030-02-15T20:00",
            timezone: "Asia/Kolkata",
            venueName: "The Durbar Hall",
            address: "12 Palace Road, Jodhpur, Rajasthan",
            mapUrl: "",
          },
        ],
  };
}

function makeSpec(displayMode: "animated" | "static", staticDate = false): InviteSpec {
  const data = input(displayMode, staticDate);
  const spec = buildInviteSpec(data, buildDefaultStyle(data.eventType, data.hosts));
  return {
    ...spec,
    image: displayMode === "animated" ? { assetId: FIXTURE_IDS.heroImage, alt: "The venue" } : null,
  };
}

function toDbEvents(spec: InviteSpec, ids: string[]): DbEvent[] {
  return spec.events.map((e, i) => ({
    id: ids[i],
    title: e.title,
    startsAt: e.startsAt,
    timezone: e.timezone,
    venueName: e.venueName,
    address: e.address,
    mapUrl: e.mapUrl,
    sort: i,
  }));
}

export interface FixtureInvite {
  invite: DbInvite;
  ownerId: string;
  eventType: EventType;
  slug: string | null;
  commonToken: string | null;
  events: DbEvent[];
  assets: DbAsset[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface FixtureGuest extends DbGuest {
  token: string;
  inviteId: string;
  phone: string | null;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
}

/** Stand-in for a row of the orders table (see supabase/migrations). */
export interface FixtureOrder {
  id: string;
  inviteId: string;
  ownerId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amountMinor: number;
  currency: string;
  status: "created" | "paid" | "failed";
  createdAt: string;
  paidAt: string | null;
}

const FIXTURE_CREATED_AT = "2030-01-01T00:00:00.000Z";

export function createFixtureData() {
  const animatedSpec = makeSpec("animated");
  const staticSpec = makeSpec("static", true);
  const base = { ownerId: FIXTURE_USER.id, eventType: "wedding" as const, slug: null, createdAt: FIXTURE_CREATED_AT, updatedAt: FIXTURE_CREATED_AT };

  const invites: FixtureInvite[] = [
    {
      ...base,
      invite: { id: FIXTURE_IDS.animatedInvite, status: "published", version: 1, displayMode: "animated", spec: animatedSpec, paid: true },
      commonToken: FIXTURE_TOKENS.common,
      events: toDbEvents(animatedSpec, [FIXTURE_IDS.weddingEvent, FIXTURE_IDS.receptionEvent]),
      assets: [
        {
          id: FIXTURE_IDS.heroImage,
          kind: "image",
          contentType: "image/webp",
          storagePath: `${FIXTURE_IDS.animatedInvite}/${FIXTURE_IDS.heroImage}.webp`,
        },
      ],
      publishedAt: FIXTURE_CREATED_AT,
    },
    {
      ...base,
      invite: { id: FIXTURE_IDS.staticInvite, status: "published", version: 1, displayMode: "static", spec: staticSpec, paid: false },
      commonToken: "fx_common_static_Mv2Rt7Ba5Xc",
      events: toDbEvents(staticSpec, [FIXTURE_IDS.staticEvent]),
      assets: [],
      publishedAt: FIXTURE_CREATED_AT,
    },
    {
      ...base,
      invite: { id: FIXTURE_IDS.draftInvite, status: "draft", version: 1, displayMode: "static", spec: staticSpec, paid: false },
      commonToken: "fx_common_draft_Qz8Lk4Nf6Hp",
      events: [],
      assets: [],
      publishedAt: null,
    },
  ];

  const guests: FixtureGuest[] = [
    {
      id: "g-alice",
      inviteId: FIXTURE_IDS.animatedInvite,
      token: FIXTURE_TOKENS.alice,
      name: "Alice Sharma",
      maxPartySize: 4,
      invitedEventIds: [],
      phone: null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      createdAt: FIXTURE_CREATED_AT,
    },
    {
      id: "g-bob",
      inviteId: FIXTURE_IDS.animatedInvite,
      token: FIXTURE_TOKENS.bob,
      name: "Bob Verma",
      maxPartySize: 2,
      invitedEventIds: [FIXTURE_IDS.receptionEvent],
      phone: null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      createdAt: FIXTURE_CREATED_AT,
    },
    {
      id: "g-carol",
      inviteId: FIXTURE_IDS.staticInvite,
      token: FIXTURE_TOKENS.carol,
      name: "Carol D'Souza",
      maxPartySize: 3,
      invitedEventIds: [],
      phone: null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      createdAt: FIXTURE_CREATED_AT,
    },
    {
      id: "g-draft",
      inviteId: FIXTURE_IDS.draftInvite,
      token: FIXTURE_TOKENS.unpublished,
      name: "Drew Draft",
      maxPartySize: 1,
      invitedEventIds: [],
      phone: null,
      firstOpenedAt: null,
      lastOpenedAt: null,
      createdAt: FIXTURE_CREATED_AT,
    },
  ];

  return { invites, guests };
}
