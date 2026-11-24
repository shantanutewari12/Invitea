// NOTE: relative imports only. This module also runs inside the service worker (Background Sync).
import { type OutboxEntry, openRegaliaDb } from "./db";

export type RsvpPayload = OutboxEntry["submission"];

export interface FlushResult {
  /** Entries the server accepted (including "already received"). */
  sent: number;
  /** Entries the server permanently rejected (kept as `failed`, never retried). */
  rejected: number;
  /** Entries still waiting (offline, 429 or 5xx). */
  remaining: number;
  /** True when another flush already held the lock. */
  skipped: boolean;
  /** Tokens whose RSVP was delivered during this flush. */
  sentTokens: string[];
}

export const rsvpApiPath = (token: string) => `/api/invites/by-token/${encodeURIComponent(token)}/rsvp`;

function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Save an RSVP to the outbox. It is written to IndexedDB first, so nothing is lost
 * if the tab closes. A guest who changes their mind before the first one was sent
 * replaces the pending entry (one RSVP per guest), keeping a fresh idempotency key.
 */
export async function enqueueRsvp(
  token: string,
  submission: Omit<RsvpPayload, "clientSubmittedAt">,
  now = Date.now(),
): Promise<OutboxEntry> {
  const db = await openRegaliaDb();
  const entry: OutboxEntry = {
    idempotencyKey: newIdempotencyKey(),
    token,
    submission: { ...submission, clientSubmittedAt: new Date(now).toISOString() },
    createdAt: now,
    attempts: 0,
    state: "pending",
  };
  const tx = db.transaction("outbox", "readwrite");
  for (const existing of await tx.store.index("by-token").getAll(token)) {
    if (existing.state === "pending") await tx.store.delete(existing.idempotencyKey);
  }
  await tx.store.put(entry);
  await tx.done;
  return entry;
}

export async function listOutbox(token?: string): Promise<OutboxEntry[]> {
  const db = await openRegaliaDb();
  const all = token ? await db.getAllFromIndex("outbox", "by-token", token) : await db.getAll("outbox");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function hasPendingRsvp(token: string): Promise<boolean> {
  return (await listOutbox(token)).some((e) => e.state === "pending");
}

let inProcessLock = false;

async function withFlushLock<T>(fn: () => Promise<T>, onBusy: () => T): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (locks && typeof locks.request === "function") {
    // Prevents the page and the service worker from flushing at the same moment.
    // Even if both did, the server's idempotency key makes a second send harmless.
    const result = await locks.request("regalia-outbox-flush", { ifAvailable: true }, async (lock) =>
      lock ? { ran: true as const, value: await fn() } : { ran: false as const },
    );
    return result.ran ? result.value : onBusy();
  }
  if (inProcessLock) return onBusy();
  inProcessLock = true;
  try {
    return await fn();
  } finally {
    inProcessLock = false;
  }
}

/**
 * Deliver pending RSVPs. Safe to call from anywhere (page load, `online` event,
 * after submit, Background Sync). Network errors, 429 and 5xx keep the entry for
 * a later retry; 2xx removes it; other 4xx marks it failed so it is not retried forever.
 */
export async function flushOutbox(
  options: { fetchImpl?: typeof fetch; now?: () => number } = {},
): Promise<FlushResult> {
  const doFetch = options.fetchImpl ?? fetch;

  return withFlushLock<FlushResult>(
    async () => {
      const db = await openRegaliaDb();
      const result: FlushResult = { sent: 0, rejected: 0, remaining: 0, skipped: false, sentTokens: [] };
      const pending = (await listOutbox()).filter((e) => e.state === "pending");

      for (const entry of pending) {
        let status = 0;
        try {
          const response = await doFetch(rsvpApiPath(entry.token), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Idempotency-Key": entry.idempotencyKey },
            body: JSON.stringify(entry.submission),
            credentials: "omit",
            keepalive: true,
          });
          status = response.status;
        } catch {
          status = 0;
        }

        if (status >= 200 && status < 300) {
          await db.delete("outbox", entry.idempotencyKey);
          result.sent += 1;
          result.sentTokens.push(entry.token);
        } else if (status === 404 || (status >= 400 && status < 500 && status !== 429 && status !== 408)) {
          await db.put("outbox", {
            ...entry,
            attempts: entry.attempts + 1,
            state: "failed",
            lastError: `http_${status}`,
          });
          result.rejected += 1;
        } else {
          await db.put("outbox", {
            ...entry,
            attempts: entry.attempts + 1,
            lastError: status === 0 ? "network" : `http_${status}`,
          });
          result.remaining += 1;
        }
      }
      return result;
    },
    () => ({ sent: 0, rejected: 0, remaining: 0, skipped: true, sentTokens: [] }),
  );
}
