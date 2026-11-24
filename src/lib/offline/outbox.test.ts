import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRegaliaDbForTests } from "./db";
import { enqueueRsvp, flushOutbox, hasPendingRsvp, listOutbox, rsvpApiPath } from "./outbox";

const TOKEN_A = "fx_alice_Wc9Qm2Zp4Rt8Xk";
const TOKEN_B = "fx_bob_Hn3Vd7Ls5Yb1Jq0";

beforeEach(() => {
  // Fresh database for every test.
  globalThis.indexedDB = new IDBFactory();
  resetRegaliaDbForTests();
});

const yes = { status: "yes" as const, partySize: 2, message: "See you there" };

/** A tiny fake server with the same idempotency semantics as the real endpoint. */
function fakeServer() {
  const received: { token: string; key: string; body: unknown }[] = [];
  const stored = new Map<string, string>(); // token -> idempotency key of the stored reply
  let online = true;
  let failNext: number | "network" | null = null;

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError("Failed to fetch");
    if (failNext === "network") {
      failNext = null;
      throw new TypeError("Failed to fetch");
    }
    if (typeof failNext === "number") {
      const status = failNext;
      failNext = null;
      return new Response("{}", { status });
    }
    const url = String(input);
    const token = decodeURIComponent(/by-token\/([^/]+)\/rsvp$/.exec(url)![1]);
    const key = (init?.headers as Record<string, string>)["Idempotency-Key"];
    received.push({ token, key, body: JSON.parse(String(init?.body)) });
    const duplicate = stored.get(token) === key;
    stored.set(token, key);
    return new Response(JSON.stringify({ ok: true, outcome: duplicate ? "duplicate" : "created" }), { status: 200 });
  }) as unknown as typeof fetch;

  return {
    fetchImpl,
    received,
    stored,
    setOnline: (v: boolean) => (online = v),
    failNextWith: (v: number | "network") => (failNext = v),
  };
}

describe("RSVP outbox", () => {
  it("writes to IndexedDB first, with an idempotency key and client timestamp", async () => {
    const entry = await enqueueRsvp(TOKEN_A, yes, Date.parse("2030-01-01T10:00:00Z"));
    expect(entry.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{16,100}$/);
    expect(entry.submission.clientSubmittedAt).toBe("2030-01-01T10:00:00.000Z");
    expect(await listOutbox()).toHaveLength(1);
    expect(await hasPendingRsvp(TOKEN_A)).toBe(true);
    expect(await hasPendingRsvp(TOKEN_B)).toBe(false);
  });

  it("delivers a queued RSVP to the right endpoint and clears the outbox", async () => {
    const server = fakeServer();
    await enqueueRsvp(TOKEN_A, yes);
    const result = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(result).toMatchObject({ sent: 1, rejected: 0, remaining: 0, skipped: false, sentTokens: [TOKEN_A] });
    expect(server.received).toHaveLength(1);
    expect(server.fetchImpl).toHaveBeenCalledWith(rsvpApiPath(TOKEN_A), expect.objectContaining({ method: "POST" }));
    expect(await listOutbox()).toHaveLength(0);
  });

  it("keeps the RSVP while offline and sends it exactly once after reconnecting", async () => {
    const server = fakeServer();
    server.setOnline(false);
    const entry = await enqueueRsvp(TOKEN_A, yes);

    // Several triggers fire while offline (open, online-event flapping, sync retries).
    for (let i = 0; i < 3; i++) {
      const offline = await flushOutbox({ fetchImpl: server.fetchImpl });
      expect(offline).toMatchObject({ sent: 0, remaining: 1 });
    }
    expect(server.received).toHaveLength(0);
    const [kept] = await listOutbox();
    expect(kept.idempotencyKey).toBe(entry.idempotencyKey); // same key on every retry
    expect(kept.attempts).toBe(3);

    server.setOnline(true);
    // Reconnect fires every fallback at once: online event, app open, Background Sync.
    const results = await Promise.all([
      flushOutbox({ fetchImpl: server.fetchImpl }),
      flushOutbox({ fetchImpl: server.fetchImpl }),
      flushOutbox({ fetchImpl: server.fetchImpl }),
    ]);
    expect(results.reduce((n, r) => n + r.sent, 0)).toBe(1);
    expect(server.received).toHaveLength(1);
    expect(await listOutbox()).toHaveLength(0);

    // A late duplicate trigger finds nothing to send.
    const again = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(again).toMatchObject({ sent: 0, remaining: 0 });
    expect(server.received).toHaveLength(1);
  });

  it("is exactly-once at the server even if the response was lost after delivery", async () => {
    const server = fakeServer();
    await enqueueRsvp(TOKEN_A, yes);

    // First attempt: the server stores the RSVP, but the response never reaches the client.
    const lossy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      await server.fetchImpl(input, init);
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const first = await flushOutbox({ fetchImpl: lossy });
    expect(first.remaining).toBe(1);

    // Retry with the same key: the server reports "duplicate", the entry is cleared.
    const second = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(second.sent).toBe(1);
    expect(server.received).toHaveLength(2); // two HTTP requests...
    expect(new Set(server.received.map((r) => r.key)).size).toBe(1); // ...one idempotency key
    expect(server.stored.size).toBe(1); // ...one stored reply
    expect(await listOutbox()).toHaveLength(0);
  });

  it("a guest who changes their mind before sync replaces the pending reply", async () => {
    const server = fakeServer();
    server.setOnline(false);
    await enqueueRsvp(TOKEN_A, { status: "yes", partySize: 2, message: "" }, 1000);
    const second = await enqueueRsvp(TOKEN_A, { status: "no", partySize: 0, message: "Sorry" }, 2000);
    await enqueueRsvp(TOKEN_B, yes, 3000);

    const queue = await listOutbox();
    expect(queue.filter((e) => e.token === TOKEN_A)).toHaveLength(1);
    expect(queue.find((e) => e.token === TOKEN_A)?.idempotencyKey).toBe(second.idempotencyKey);

    server.setOnline(true);
    const result = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(result.sent).toBe(2);
    expect(server.received.find((r) => r.token === TOKEN_A)?.body).toMatchObject({ status: "no" });
  });

  it.each([429, 500, 503, 408])("keeps the entry for retry on HTTP %i", async (status) => {
    const server = fakeServer();
    await enqueueRsvp(TOKEN_A, yes);
    server.failNextWith(status);
    const result = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(result).toMatchObject({ sent: 0, remaining: 1, rejected: 0 });
    expect((await listOutbox())[0].state).toBe("pending");
  });

  it.each([400, 404, 422])("stops retrying forever on a permanent HTTP %i", async (status) => {
    const server = fakeServer();
    await enqueueRsvp(TOKEN_A, yes);
    server.failNextWith(status);
    const result = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(result).toMatchObject({ sent: 0, remaining: 0, rejected: 1 });
    const [entry] = await listOutbox();
    expect(entry.state).toBe("failed");

    // A failed entry is not sent again.
    const again = await flushOutbox({ fetchImpl: server.fetchImpl });
    expect(again).toMatchObject({ sent: 0, remaining: 0, rejected: 0 });
  });

  it("survives a reload: entries are durable and sent in the order they were made", async () => {
    await enqueueRsvp(TOKEN_B, yes, 2000);
    await enqueueRsvp(TOKEN_A, yes, 1000);
    resetRegaliaDbForTests(); // simulate a new page load: the connection is gone, the data is not

    const order: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      order.push(decodeURIComponent(/by-token\/([^/]+)\/rsvp$/.exec(String(input))![1]));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const result = await flushOutbox({ fetchImpl });
    expect(result.sent).toBe(2);
    expect(order).toEqual([TOKEN_A, TOKEN_B]);
  });
});
