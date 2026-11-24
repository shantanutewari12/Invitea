import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { as, createTestDb } from "./harness";

const ALICE = "aaaaaaaa-0000-4000-8000-00000000000a";
const BOB = "bbbbbbbb-0000-4000-8000-00000000000b";

const INVITE_A = "a1111111-0000-4000-8000-000000000001";
const INVITE_B = "b2222222-0000-4000-8000-000000000002";
const INVITE_DRAFT = "d3333333-0000-4000-8000-000000000003";

const GUEST_A1 = "a0000001-0000-4000-8000-0000000000a1";
const GUEST_A2 = "a0000002-0000-4000-8000-0000000000a2";
const GUEST_B1 = "b0000001-0000-4000-8000-0000000000b1";
const GUEST_DRAFT = "d0000001-0000-4000-8000-0000000000d1";

const TOKENS = {
  a1: "tok_alice_guest_one_AAAAAAA",
  a2: "tok_alice_guest_two_AAAAAAA",
  b1: "tok_bob___guest_one_BBBBBBB",
  draft: "tok_draft_guest_one_DDDDDD",
  common: "tok_common_link_alice_AAA",
};

const spec = JSON.stringify({ schemaVersion: 1, headline: "Aarav & Meera" });

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();

  // Users: the on_auth_user_created trigger must create the profiles.
  await db.query("insert into auth.users (id, email) values ($1, 'alice@example.com'), ($2, 'bob@example.com')", [ALICE, BOB]);

  // Seed as the service role would (superuser here: bypasses RLS like service_role does).
  await db.query(
    `insert into public.invites (id, owner_id, event_type, status, spec, common_token) values
       ($1, $4, 'wedding', 'published', $6::jsonb, $7),
       ($2, $5, 'birthday', 'published', $6::jsonb, 'tok_common_link_bob_BBBBB'),
       ($3, $4, 'wedding', 'draft', $6::jsonb, 'tok_common_link_draft_DDD')`,
    [INVITE_A, INVITE_B, INVITE_DRAFT, ALICE, BOB, spec, TOKENS.common],
  );
  await db.query(
    `insert into public.invite_events (invite_id, title, starts_at, timezone) values
       ($1, 'Ceremony', '2030-02-14T13:00:00Z', 'Asia/Kolkata'),
       ($2, 'Party', '2030-03-01T13:00:00Z', 'Asia/Kolkata')`,
    [INVITE_A, INVITE_B],
  );
  await db.query(
    `insert into public.guests (id, invite_id, name, token, max_party_size) values
       ($1, $5, 'Guest A1', $8, 4),
       ($2, $5, 'Guest A2', $9, 2),
       ($3, $6, 'Guest B1', $10, 3),
       ($4, $7, 'Guest Draft', $11, 2)`,
    [GUEST_A1, GUEST_A2, GUEST_B1, GUEST_DRAFT, INVITE_A, INVITE_B, INVITE_DRAFT, TOKENS.a1, TOKENS.a2, TOKENS.b1, TOKENS.draft],
  );
  await db.query(
    `insert into public.rsvps (guest_id, invite_id, status, party_size, idempotency_key, client_submitted_at) values
       ($1, $3, 'yes', 2, 'seed-key-a1-0000000000', now()),
       ($2, $4, 'no', 0, 'seed-key-b1-0000000000', now())`,
    [GUEST_A1, GUEST_B1, INVITE_A, INVITE_B],
  );
  await db.query(
    `insert into public.assets (invite_id, owner_id, kind, content_type, storage_path, bytes) values
       ($1, $3, 'image', 'image/webp', 'alice/a.webp', 1000), ($2, $4, 'image', 'image/webp', 'bob/b.webp', 1000)`,
    [INVITE_A, INVITE_B, ALICE, BOB],
  );
  await db.query(
    `insert into public.orders (invite_id, owner_id, razorpay_order_id, amount_minor, status) values
       ($1, $3, 'order_alice_1', 49900, 'paid'), ($2, $4, 'order_bob_1', 49900, 'created')`,
    [INVITE_A, INVITE_B, ALICE, BOB],
  );
  await db.query(
    `insert into public.ai_usage (user_id, provider, model, outcome) values ($1, 'gemini', 'm', 'success'), ($2, 'gemini', 'm', 'success')`,
    [ALICE, BOB],
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const ids = (rows: { id?: string }[]) => rows.map((r) => r.id).sort();

describe("schema hygiene", () => {
  it("has row level security enabled on EVERY table in public", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(
      ["ai_usage", "assets", "guests", "invite_events", "invites", "orders", "profiles", "rate_limits", "rsvps"],
    );
    expect(rows.filter((r) => !r.relrowsecurity)).toEqual([]);
  });

  it("creates a profile for every new auth user", async () => {
    const { rows } = await db.query<{ id: string; email: string }>("select id, email from public.profiles order by email");
    expect(rows).toEqual([
      { id: ALICE, email: "alice@example.com" },
      { id: BOB, email: "bob@example.com" },
    ]);
  });

  it("keeps the asset bucket private with size and type limits", async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'invite-assets'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(5 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).toContain("image/webp");
    expect(rows[0].allowed_mime_types).not.toContain("text/html");
    expect(rows[0].allowed_mime_types).not.toContain("image/svg+xml");
  });

  it("generates URL-safe 21-character tokens by default", async () => {
    const { rows } = await db.query<{ t: string }>("select public.regalia_token() as t from generate_series(1, 50)");
    for (const { t } of rows) expect(t).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(new Set(rows.map((r) => r.t)).size).toBe(50);
  });
});

describe("hosts can only read their own data", () => {
  it("sees own invites, events, guests, rsvps, assets, orders and ai usage - and nothing of anyone else's", async () => {
    await as(db, "authenticated", ALICE, async (tx) => {
      expect(ids((await tx.query<{ id: string }>("select id from public.invites")).rows)).toEqual([INVITE_A, INVITE_DRAFT].sort());
      expect((await tx.query("select 1 from public.invite_events")).rows).toHaveLength(1);
      expect(ids((await tx.query<{ id: string }>("select id from public.guests")).rows)).toEqual([GUEST_A1, GUEST_A2, GUEST_DRAFT].sort());
      expect((await tx.query("select 1 from public.rsvps")).rows).toHaveLength(1);
      expect((await tx.query("select 1 from public.assets")).rows).toHaveLength(1);
      expect((await tx.query("select 1 from public.orders")).rows).toHaveLength(1);
      expect((await tx.query("select 1 from public.ai_usage")).rows).toHaveLength(1);
      expect((await tx.query("select 1 from public.profiles")).rows).toHaveLength(1);
    });
  });

  it("cannot read another host's rows even when asking for them by id or token", async () => {
    await as(db, "authenticated", ALICE, async (tx) => {
      expect((await tx.query("select 1 from public.invites where id = $1", [INVITE_B])).rows).toHaveLength(0);
      expect((await tx.query("select 1 from public.guests where id = $1", [GUEST_B1])).rows).toHaveLength(0);
      expect((await tx.query("select 1 from public.guests where token = $1", [TOKENS.b1])).rows).toHaveLength(0);
      expect((await tx.query("select 1 from public.rsvps where guest_id = $1", [GUEST_B1])).rows).toHaveLength(0);
      expect((await tx.query("select 1 from public.orders where razorpay_order_id = 'order_bob_1'")).rows).toHaveLength(0);
    });
    await as(db, "authenticated", BOB, async (tx) => {
      expect((await tx.query("select 1 from public.invites where id = $1", [INVITE_A])).rows).toHaveLength(0);
      expect((await tx.query("select 1 from public.guests where token = $1", [TOKENS.a1])).rows).toHaveLength(0);
    });
  });

  it("a signed-in user with no JWT subject sees nothing", async () => {
    await as(db, "authenticated", null, async (tx) => {
      for (const table of ["invites", "guests", "rsvps", "orders", "assets", "profiles", "ai_usage", "invite_events"]) {
        expect((await tx.query(`select 1 from public.${table}`)).rows, table).toHaveLength(0);
      }
    });
  });
});

describe("hosts cannot write directly (all writes go through validated server routes)", () => {
  const attempts: [string, string, unknown[]][] = [
    ["insert an invite", "insert into public.invites (owner_id, event_type, spec) values ($1, 'wedding', '{}'::jsonb)", [ALICE]],
    ["update an invite (e.g. force-publish)", "update public.invites set status = 'published' where id = $1", [INVITE_DRAFT]],
    ["delete an invite", "delete from public.invites where id = $1", [INVITE_A]],
    ["insert a guest (would bypass the Free guest cap)", "insert into public.guests (invite_id, name) values ($1, 'Sneaky')", [INVITE_A]],
    ["update a guest token", "update public.guests set token = 'tok_hijacked_token_value' where id = $1", [GUEST_A1]],
    ["insert an RSVP directly", "insert into public.rsvps (guest_id, invite_id, status, party_size, idempotency_key, client_submitted_at) values ($1, $2, 'yes', 1, 'direct-insert-key-0000', now())", [GUEST_A2, INVITE_A]],
    ["grant themselves a paid plan", "insert into public.orders (invite_id, owner_id, razorpay_order_id, amount_minor, status) values ($1, $2, 'fake_order', 49900, 'paid')", [INVITE_DRAFT, ALICE]],
    ["mark their own order paid", "update public.orders set status = 'paid' where owner_id = $1", [ALICE]],
    ["insert an asset row", "insert into public.assets (invite_id, owner_id, kind, content_type, storage_path, bytes) values ($1, $2, 'image', 'image/webp', 'x/y.webp', 10)", [INVITE_A, ALICE]],
    ["write AI usage", "insert into public.ai_usage (user_id, provider, model, outcome) values ($1, 'x', 'y', 'success')", [ALICE]],
    ["delete AI usage to reset a quota", "delete from public.ai_usage where user_id = $1", [ALICE]],
    ["change their email on the profile", "update public.profiles set email = 'evil@example.com' where id = $1", [ALICE]],
  ];

  it.each(attempts)("cannot %s", async (_label, sql, params) => {
    await expect(as(db, "authenticated", ALICE, (tx) => tx.query(sql, params))).rejects.toThrow(/permission denied/i);
  });

  it("may rename themselves, but only themselves", async () => {
    await as(db, "authenticated", ALICE, async (tx) => {
      const own = await tx.query("update public.profiles set display_name = 'Alice A' where id = $1", [ALICE]);
      expect(own.affectedRows).toBe(1);
      const other = await tx.query("update public.profiles set display_name = 'Hacked' where id = $1", [BOB]);
      expect(other.affectedRows).toBe(0);
    });
  });
});

describe("anonymous visitors", () => {
  it.each(["profiles", "invites", "invite_events", "guests", "rsvps", "orders", "assets", "ai_usage", "rate_limits"])(
    "cannot read %s",
    async (table) => {
      await expect(as(db, "anon", null, (tx) => tx.query(`select 1 from public.${table}`))).rejects.toThrow(/permission denied/i);
    },
  );

  it("cannot write anywhere", async () => {
    await expect(
      as(db, "anon", null, (tx) => tx.query("insert into public.rsvps (guest_id, invite_id, status, party_size, idempotency_key, client_submitted_at) values ($1, $2, 'yes', 1, 'anon-direct-key-00000', now())", [GUEST_A2, INVITE_A])),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("privileged functions", () => {
  it("rate_limits is invisible to hosts", async () => {
    await expect(as(db, "authenticated", ALICE, (tx) => tx.query("select 1 from public.rate_limits"))).rejects.toThrow(/permission denied/i);
  });

  it.each([
    ["upsert_rsvp", "select public.upsert_rsvp($1, 'direct-call-key-000000', 'yes', 1, '', now())", [TOKENS.a2]],
    ["consume_rate_limit", "select public.consume_rate_limit('k', 60, 10)", []],
    ["save_invite", "select public.save_invite($1, null, 'wedding', 'static', '{}'::jsonb)", [ALICE]],
  ])("%s is not callable by anon or signed-in users", async (_name, sql, params) => {
    await expect(as(db, "authenticated", ALICE, (tx) => tx.query(sql, params))).rejects.toThrow(/permission denied/i);
    await expect(as(db, "anon", null, (tx) => tx.query(sql, params))).rejects.toThrow(/permission denied/i);
  });
});

describe("upsert_rsvp (service role)", () => {
  const call = (token: string, key: string, status: string, party: number, at: string, message = "") =>
    as(db, "service_role", null, async (tx) => {
      const { rows } = await tx.query<{ r: string }>("select public.upsert_rsvp($1, $2, $3, $4, $5, $6::timestamptz) as r", [
        token,
        key,
        status,
        party,
        message,
        at,
      ]);
      return rows[0].r;
    });

  // These tests write for real, so each uses its own guest and its own transaction-less path.
  const run = async (token: string, key: string, status: string, party: number, at: string, message = "") => {
    const { rows } = await db.query<{ r: string }>("select public.upsert_rsvp($1, $2, $3, $4, $5, $6::timestamptz) as r", [
      token,
      key,
      status,
      party,
      message,
      at,
    ]);
    return rows[0].r;
  };

  it("is callable by the service role", async () => {
    expect(await call(TOKENS.a2, "service-call-key-000001", "yes", 1, "2030-01-01T10:00:00Z")).toBe("created");
  });

  it("creates once, treats retries as duplicates, replaces with newer replies, ignores older ones", async () => {
    await db.query("delete from public.rsvps where guest_id = $1", [GUEST_A2]);
    const t0 = "2030-01-01T10:00:00Z";
    const t1 = "2030-01-01T11:00:00Z";

    expect(await run(TOKENS.a2, "key-first-0000000000", "yes", 2, t0, "hello")).toBe("created");
    for (let i = 0; i < 3; i++) expect(await run(TOKENS.a2, "key-first-0000000000", "yes", 2, t0, "hello")).toBe("duplicate");

    expect(await run(TOKENS.a2, "key-second-000000000", "no", 0, t1)).toBe("updated");
    // The first reply's late retry (old key, older timestamp) must not resurrect "yes".
    expect(await run(TOKENS.a2, "key-first-0000000000", "yes", 2, t0, "hello")).toBe("stale");
    expect(await run(TOKENS.a2, "key-second-000000000", "no", 0, t1)).toBe("duplicate");

    const { rows } = await db.query<{ status: string; party_size: number }>("select status, party_size from public.rsvps where guest_id = $1", [GUEST_A2]);
    expect(rows).toEqual([{ status: "no", party_size: 0 }]);
  });

  it("exactly one row per guest even when many deliveries race", async () => {
    await db.query("delete from public.rsvps where guest_id = $1", [GUEST_A1]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => run(TOKENS.a1, "race-key-00000000000", "yes", 1, "2030-01-01T10:00:00Z")),
    );
    expect(results.filter((r) => r === "created")).toHaveLength(1);
    expect(results.filter((r) => r === "duplicate")).toHaveLength(5);
    const { rows } = await db.query("select 1 from public.rsvps where guest_id = $1", [GUEST_A1]);
    expect(rows).toHaveLength(1);
  });

  it("enforces the guest's party size limit", async () => {
    expect(await run(TOKENS.a2, "key-party-000000000", "yes", 3, "2031-01-01T10:00:00Z")).toBe("invalid_party_size"); // limit 2
    expect(await run(TOKENS.a2, "key-party-000000001", "yes", -1, "2031-01-01T10:00:00Z")).toBe("invalid_party_size");
  });

  it("only works for personal tokens of published invites", async () => {
    expect(await run(TOKENS.common, "key-common-00000000", "yes", 1, "2030-01-01T10:00:00Z")).toBe("not_found");
    expect(await run("tok_unknown_unknown_UUUUU", "key-unknown-0000000", "yes", 1, "2030-01-01T10:00:00Z")).toBe("not_found");
    expect(await run(TOKENS.draft, "key-draft-000000000", "yes", 1, "2030-01-01T10:00:00Z")).toBe("not_found");
    const { rows } = await db.query("select 1 from public.rsvps where guest_id = $1", [GUEST_DRAFT]);
    expect(rows).toHaveLength(0);
  });

  it("never writes to a different guest than the token's", async () => {
    const before = await db.query<{ status: string }>("select status from public.rsvps where guest_id = $1", [GUEST_B1]);
    await run(TOKENS.a1, "key-isolation-00000000", "maybe", 1, "2032-01-01T10:00:00Z");
    const after = await db.query<{ status: string }>("select status from public.rsvps where guest_id = $1", [GUEST_B1]);
    expect(after.rows).toEqual(before.rows);
  });

  it("rejects values the table does not allow", async () => {
    await expect(run(TOKENS.a2, "key-badstatus-0000000", "definitely", 1, "2033-01-01T10:00:00Z")).rejects.toThrow(/check constraint/i);
  });
});

describe("save_invite (service role)", () => {
  const EV1 = "e1111111-0000-4000-8000-000000000001";
  const EV2 = "e2222222-0000-4000-8000-000000000002";
  const EV3 = "e3333333-0000-4000-8000-000000000003";
  const specWith = (events: { id: string; title: string }[]) =>
    JSON.stringify({
      schemaVersion: 1,
      events: events.map((e) => ({ ...e, startsAt: "2030-05-01T10:00:00+05:30", timezone: "Asia/Kolkata", venueName: "Hall", address: "", mapUrl: "" })),
    });
  const save = async (owner: string, id: string | null, events: { id: string; title: string }[], mode = "static") => {
    const { rows } = await db.query<{ id: string | null }>("select public.save_invite($1, $2, 'birthday', $3, $4::jsonb) as id", [owner, id, mode, specWith(events)]);
    return rows[0].id;
  };
  const eventsOf = async (inviteId: string) =>
    (await db.query<{ id: string; title: string; sort: number }>("select id, title, sort from public.invite_events where invite_id = $1 order by sort", [inviteId])).rows;

  it("creates a draft with its events in order, and replaces them on update", async () => {
    const id = await save(ALICE, null, [{ id: EV1, title: "One" }, { id: EV2, title: "Two" }]);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    const created = await db.query<{ status: string; version: number; display_mode: string }>("select status, version, display_mode from public.invites where id = $1", [id]);
    expect(created.rows[0]).toEqual({ status: "draft", version: 1, display_mode: "static" });
    expect(await eventsOf(id!)).toEqual([
      { id: EV1, title: "One", sort: 0 },
      { id: EV2, title: "Two", sort: 1 },
    ]);

    // Update: rename one, drop one, add one, reorder. The version is bumped.
    expect(await save(ALICE, id, [{ id: EV3, title: "Three" }, { id: EV2, title: "Two renamed" }], "animated")).toBe(id);
    expect(await eventsOf(id!)).toEqual([
      { id: EV3, title: "Three", sort: 0 },
      { id: EV2, title: "Two renamed", sort: 1 },
    ]);
    const updated = await db.query<{ version: number; display_mode: string }>("select version, display_mode from public.invites where id = $1", [id]);
    expect(updated.rows[0]).toEqual({ version: 2, display_mode: "animated" });
  });

  it("refuses to touch another host's invite and changes nothing", async () => {
    const before = await db.query("select spec, version from public.invites where id = $1", [INVITE_A]);
    expect(await save(BOB, INVITE_A, [{ id: EV1, title: "Hijack" }])).toBeNull();
    const after = await db.query("select spec, version from public.invites where id = $1", [INVITE_A]);
    expect(after.rows).toEqual(before.rows);
    expect((await eventsOf(INVITE_A)).map((e) => e.title)).not.toContain("Hijack");
  });

  it("an event id that belongs to another invite is not taken over", async () => {
    const [existing] = await eventsOf(INVITE_A);
    const id = await save(BOB, null, [{ id: existing.id, title: "Stolen" }]);
    expect((await eventsOf(INVITE_A)).find((e) => e.id === existing.id)?.title).toBe(existing.title);
    expect(await eventsOf(id!)).toEqual([]); // the conflicting event is simply not written
  });

  it("rolls back completely when an event is invalid", async () => {
    const countBefore = (await db.query("select 1 from public.invites")).rows.length;
    await expect(
      db.query("select public.save_invite($1, null, 'wedding', 'static', $2::jsonb)", [ALICE, JSON.stringify({ events: [{ id: EV1 }] })]),
    ).rejects.toThrow();
    expect((await db.query("select 1 from public.invites")).rows.length).toBe(countBefore);
  });
});

describe("consume_rate_limit (service role)", () => {
  const hit = async (key: string, window: number, max: number) => {
    const { rows } = await db.query<{ ok: boolean }>("select public.consume_rate_limit($1, $2, $3) as ok", [key, window, max]);
    return rows[0].ok;
  };

  it("allows up to the maximum, then refuses", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hit("test:limit", 3600, 3));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("counts every key separately", async () => {
    expect(await hit("test:user-1", 3600, 1)).toBe(true);
    expect(await hit("test:user-1", 3600, 1)).toBe(false);
    expect(await hit("test:user-2", 3600, 1)).toBe(true);
  });
});

describe("data integrity", () => {
  it("records a payment only once: razorpay_payment_id is unique", async () => {
    await db.query("update public.orders set razorpay_payment_id = 'pay_123' where razorpay_order_id = 'order_alice_1'");
    await expect(
      db.query("update public.orders set razorpay_payment_id = 'pay_123' where razorpay_order_id = 'order_bob_1'"),
    ).rejects.toThrow(/unique/i);
  });

  it("rejects malformed slugs, tokens, map links and sizes", async () => {
    const bad: [string, unknown[]][] = [
      ["update public.invites set slug = 'Has Spaces' where id = $1", [INVITE_A]],
      ["update public.invites set slug = 'ab' where id = $1", [INVITE_A]],
      ["update public.invites set common_token = 'short' where id = $1", [INVITE_A]],
      ["insert into public.guests (invite_id, name, token) values ($1, 'X', 'bad token with spaces!!')", [INVITE_A]],
      ["insert into public.guests (invite_id, name, max_party_size) values ($1, 'X', 99)", [INVITE_A]],
      ["insert into public.guests (invite_id, name, phone) values ($1, 'X', 'call me')", [INVITE_A]],
      ["insert into public.invite_events (invite_id, title, starts_at, timezone, map_url) values ($1, 'T', now(), 'UTC', 'javascript:alert(1)')", [INVITE_A]],
      ["insert into public.invite_events (invite_id, title, starts_at, timezone, map_url) values ($1, 'T', now(), 'UTC', 'http://insecure.example')", [INVITE_A]],
      ["insert into public.assets (invite_id, owner_id, kind, content_type, storage_path, bytes) values ($1, $2, 'image', 'image/svg+xml', 'p', 10)", [INVITE_A, ALICE]],
      ["insert into public.assets (invite_id, owner_id, kind, content_type, storage_path, bytes) values ($1, $2, 'image', 'image/webp', 'p2', 99999999)", [INVITE_A, ALICE]],
    ];
    for (const [sql, params] of bad) await expect(db.query(sql, params), sql).rejects.toThrow();
  });

  it("accepts a well-formed custom slug", async () => {
    await db.query("update public.invites set slug = 'aarav-weds-meera' where id = $1", [INVITE_A]);
    const { rows } = await db.query<{ slug: string }>("select slug from public.invites where id = $1", [INVITE_A]);
    expect(rows[0].slug).toBe("aarav-weds-meera");
  });

  it("deleting an invite removes its events, guests, rsvps and assets", async () => {
    await db.query("delete from public.invites where id = $1", [INVITE_B]);
    for (const table of ["invite_events", "guests", "rsvps", "assets", "orders"]) {
      const { rows } = await db.query(`select 1 from public.${table} where invite_id = $1`, [INVITE_B]);
      expect(rows, table).toHaveLength(0);
    }
  });
});
