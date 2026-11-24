// NOTE: relative imports only. This module is also bundled into the service worker.
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

import type { InvitePayload } from "../invite-payload";

export const DB_NAME = "regalia";
export const DB_VERSION = 1;

export interface StoredInvite {
  /** Invite key from the URL (/i/<key>). */
  token: string;
  payload: InvitePayload;
  etag: string | null;
  /** When the payload was first saved on this device. */
  savedAt: number;
  /** Last successful check against the server. */
  checkedAt: number;
}

export interface StoredAsset {
  /** `${token}:${assetId}` */
  key: string;
  token: string;
  assetId: string;
  blob: Blob;
  contentType: string;
}

export interface OutboxEntry {
  /** Doubles as the primary key. Generated once per RSVP, reused on every retry. */
  idempotencyKey: string;
  token: string;
  /** JSON body for POST /api/invites/by-token/[token]/rsvp */
  submission: {
    status: "yes" | "no" | "maybe";
    partySize: number;
    message: string;
    clientSubmittedAt: string;
  };
  createdAt: number;
  attempts: number;
  state: "pending" | "failed";
  lastError?: string;
}

interface RegaliaDB extends DBSchema {
  invites: { key: string; value: StoredInvite };
  assets: { key: string; value: StoredAsset; indexes: { "by-token": string } };
  outbox: { key: string; value: OutboxEntry; indexes: { "by-token": string; "by-created": number } };
  meta: { key: string; value: unknown };
}

export type RegaliaDatabase = IDBPDatabase<RegaliaDB>;

let dbPromise: Promise<RegaliaDatabase> | null = null;

/** Open (and memoise) the database. Works in windows and in the service worker. */
export function openRegaliaDb(): Promise<RegaliaDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<RegaliaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("invites", { keyPath: "token" });
        const assets = db.createObjectStore("assets", { keyPath: "key" });
        assets.createIndex("by-token", "token");
        const outbox = db.createObjectStore("outbox", { keyPath: "idempotencyKey" });
        outbox.createIndex("by-token", "token");
        outbox.createIndex("by-created", "createdAt");
        db.createObjectStore("meta");
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Test helper: forget the memoised connection. */
export function resetRegaliaDbForTests(): void {
  dbPromise = null;
}
