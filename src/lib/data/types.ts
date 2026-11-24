import type { DisplayMode, RsvpStatus } from "@/lib/spec/constants";
import type { InviteSpec, RsvpSubmission } from "@/lib/spec/schema";

export interface DbInvite {
  id: string;
  status: "draft" | "published";
  version: number;
  displayMode: DisplayMode;
  spec: InviteSpec;
  /** True once a paid order exists for this invite. */
  paid: boolean;
}

export interface DbEvent {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  venueName: string;
  address: string;
  mapUrl: string;
  sort: number;
}

export interface DbGuest {
  id: string;
  name: string;
  maxPartySize: number;
  invitedEventIds: string[];
}

export interface DbAsset {
  id: string;
  kind: "image" | "audio";
  contentType: string;
  storagePath: string;
}

export interface DbRsvp {
  status: RsvpStatus;
  partySize: number;
  message: string;
}

/** Everything the server needs to answer a token lookup, scoped to ONE token. */
export interface TokenLookup {
  invite: DbInvite;
  /** Null when the token is the invite's common link (or slug). */
  guest: DbGuest | null;
  events: DbEvent[];
  assets: DbAsset[];
  rsvp: DbRsvp | null;
}

export type RsvpOutcome = "created" | "updated" | "duplicate" | "stale";

export type UpsertRsvpResult =
  | { ok: true; outcome: RsvpOutcome }
  | { ok: false; reason: "not_found" | "party_size" };

export interface UpsertRsvpArgs {
  token: string;
  idempotencyKey: string;
  submission: RsvpSubmission;
}

export interface AssetContent {
  bytes: Uint8Array;
  contentType: string;
}

export interface RegisterGuestArgs {
  inviteId: string;
  name: string;
  maxPartySize: number;
  /** Plan limit on guests for this invite (null = unlimited). */
  cap: number | null;
}

/** Data access for the public (token-based) endpoints. */
export interface InviteRepo {
  lookupToken(token: string): Promise<TokenLookup | null>;
  recordOpen(guestId: string): Promise<void>;
  upsertRsvp(args: UpsertRsvpArgs): Promise<UpsertRsvpResult>;
  /** Common-link replies: adds a self-registered guest. Returns the new personal token, or "cap" when the plan is full. */
  registerGuest(args: RegisterGuestArgs): Promise<{ token: string } | "cap">;
  /** Returns the asset only if it belongs to the invite behind `token` and is referenced by it. */
  getAssetByToken(token: string, assetId: string): Promise<AssetContent | null>;
  /** Fixed-window counter. Returns true when the call is allowed. */
  consumeRateLimit(key: string, windowSeconds: number, max: number): Promise<boolean>;
}
