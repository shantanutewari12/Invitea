import "server-only";

import { inviteSpecSchema } from "@/lib/spec/schema";

import type { DbAsset, DbEvent, DbGuest, DbInvite } from "./types";

/** Helpers shared by the Supabase-backed repositories (guest token API and host API). */
export type Row = Record<string, unknown>;

export type QueryResult = { data: unknown; error: { message: string } | null };

/** Unwrap a Supabase result that holds at most one row. */
export function one(result: QueryResult, what: string): Row | null {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data as Row | null) ?? null;
}

/** Unwrap a Supabase result that holds a list of rows. */
export function many(result: QueryResult, what: string): Row[] {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return (result.data as Row[] | null) ?? [];
}

export function mapInvite(row: Row, paid: boolean): DbInvite {
  const spec = inviteSpecSchema.safeParse(row.spec);
  if (!spec.success) throw new Error(`Stored spec for invite ${String(row.id)} is invalid`);
  return {
    id: String(row.id),
    status: row.status === "published" ? "published" : "draft",
    version: Number(row.version),
    displayMode: row.display_mode === "static" ? "static" : "animated",
    spec: spec.data,
    paid,
  };
}

export const mapEvent = (row: Row): DbEvent => ({
  id: String(row.id),
  title: String(row.title),
  startsAt: new Date(String(row.starts_at)).toISOString(),
  timezone: String(row.timezone),
  venueName: String(row.venue_name ?? ""),
  address: String(row.address ?? ""),
  mapUrl: String(row.map_url ?? ""),
  sort: Number(row.sort ?? 0),
});

export const mapGuest = (row: Row): DbGuest => ({
  id: String(row.id),
  name: String(row.name),
  maxPartySize: Number(row.max_party_size),
  invitedEventIds: Array.isArray(row.invited_event_ids) ? (row.invited_event_ids as string[]) : [],
});

export const mapAsset = (row: Row): DbAsset => ({
  id: String(row.id),
  kind: row.kind === "audio" ? "audio" : "image",
  contentType: String(row.content_type ?? "application/octet-stream"),
  storagePath: String(row.storage_path),
});
