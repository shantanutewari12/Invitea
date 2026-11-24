import type { DbAsset, DbEvent, DbInvite } from "@/lib/data/types";
import type { DisplayMode, EventType } from "@/lib/spec/constants";
import type { InviteSpec } from "@/lib/spec/schema";

/** The signed-in host. */
export interface HostUser {
  id: string;
  email: string;
}

export interface RsvpCounts {
  yes: number;
  no: number;
  maybe: number;
  /** Guests who have not replied yet. */
  pending: number;
  /** Total people attending: the sum of party sizes of "yes" replies. */
  attending: number;
}

export interface InviteSummary {
  id: string;
  status: "draft" | "published";
  displayMode: DisplayMode;
  eventType: EventType;
  headline: string;
  hosts: string[];
  firstEventAt: string | null;
  updatedAt: string;
  guestCount: number;
  rsvp: RsvpCounts;
  paid: boolean;
}

/** Everything the builder and share screens need about one invitation (host view). */
export interface HostInvite extends DbInvite {
  ownerId: string;
  eventType: EventType;
  slug: string | null;
  /** Token of the generic-greeting link (poster QR, family WhatsApp group). */
  commonToken: string;
  events: DbEvent[];
  assets: DbAsset[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface HostGuest {
  id: string;
  name: string;
  phone: string | null;
  /** The secret in this guest's personal link. Only the owning host ever sees it. */
  token: string;
  maxPartySize: number;
  invitedEventIds: string[];
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  rsvp: { status: "yes" | "no" | "maybe"; partySize: number; message: string; updatedAt: string } | null;
}

export interface NewGuest {
  name: string;
  phone: string | null;
  maxPartySize: number;
  token: string;
}

export interface SaveInviteInput {
  /** Null creates a new invite. */
  id: string | null;
  eventType: EventType;
  displayMode: DisplayMode;
  /** Validated and sanitised spec whose events all carry ids. */
  spec: InviteSpec;
}

export interface NewAsset {
  id: string;
  kind: "image" | "audio";
  contentType: string;
  storagePath: string;
  bytes: number;
}

export interface AiUsageEntry {
  userId: string;
  inviteId: string | null;
  provider: string;
  model: string;
  outcome: "success" | "retried" | "fallback" | "error";
  promptChars: number;
  latencyMs: number;
}

export interface HostOrder {
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

/**
 * Host-side data access. Every method is scoped by `ownerId`: another host's invite is
 * indistinguishable from a missing one (null / false), so route handlers cannot leak by
 * forgetting a check. Payment methods are the exception: webhooks have no signed-in user and
 * are only called after the Razorpay signature was verified.
 */
export interface HostRepo {
  listInvites(ownerId: string): Promise<InviteSummary[]>;
  getInvite(ownerId: string, inviteId: string): Promise<HostInvite | null>;
  /** Insert (id null) or update an invite and replace its events from `spec.events`, atomically. */
  saveInvite(ownerId: string, input: SaveInviteInput): Promise<HostInvite | null>;
  setStatus(ownerId: string, inviteId: string, status: "draft" | "published"): Promise<HostInvite | null>;
  setSlug(ownerId: string, inviteId: string, slug: string | null): Promise<"ok" | "taken" | "not_found">;

  listGuests(ownerId: string, inviteId: string): Promise<HostGuest[] | null>;
  addGuests(ownerId: string, inviteId: string, guests: NewGuest[]): Promise<HostGuest[] | null>;
  removeGuest(ownerId: string, inviteId: string, guestId: string): Promise<boolean>;
  /** Deletes the invite with its events, guests, replies and files. False when it is not the owner's. */
  deleteInvite(ownerId: string, inviteId: string): Promise<boolean>;

  registerAsset(ownerId: string, inviteId: string, asset: NewAsset): Promise<DbAsset | null>;
  logAiUsage(entry: AiUsageEntry): Promise<void>;

  createOrder(
    ownerId: string,
    inviteId: string,
    order: { razorpayOrderId: string; amountMinor: number; currency: string },
  ): Promise<HostOrder | null>;
  getOrderByRazorpayId(razorpayOrderId: string): Promise<HostOrder | null>;
  /**
   * Record a captured payment. Idempotent: `granted` is true only for the call that moved the
   * order to paid; replays (same payment id) return `granted: false` and change nothing.
   */
  markOrderPaid(
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ): Promise<{ granted: boolean; order: HostOrder } | null>;
}
