import { beforeEach, describe, expect, it } from "vitest";

import { PLANS } from "@/config/plans";
import { createFixtureRepo, resetFixtureState } from "@/lib/data/fixture-repo";
import { FIXTURE_IDS, FIXTURE_USER } from "@/lib/data/fixtures";
import { createFixtureHostRepo } from "@/lib/host/fixture-host-repo";
import type { HostApiContext } from "@/lib/host/context";
import type { AssetStorage } from "@/lib/host/storage";
import type { HostRepo } from "@/lib/host/types";

import {
  handleAddGuests,
  handleConfirmUpload,
  handleCreateInvite,
  handleSetSlug,
  handleSetStatus,
  handleSignUpload,
  handleUpdateInvite,
} from "./invites";

const OTHER = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", email: "other@regalia.test" };
const FREE = FIXTURE_IDS.staticInvite;
const PAID = FIXTURE_IDS.animatedInvite;

let repo: HostRepo;
const ctxFor = (user: { id: string; email: string }): HostApiContext => ({ user, repo, limiter: createFixtureRepo() });
const owner = () => ctxFor({ id: FIXTURE_USER.id, email: FIXTURE_USER.email });
const req = (body: unknown, method = "POST") =>
  new Request("http://localhost/api", { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

beforeEach(() => {
  resetFixtureState();
  repo = createFixtureHostRepo();
});

const specOf = async (id: string) => (await repo.getInvite(FIXTURE_USER.id, id))!.spec;

describe("invite create / update", () => {
  it("stores a validated spec with server-assigned event ids and returns the invite", async () => {
    const base = await specOf(FREE);
    const res = await handleCreateInvite(req({ spec: { ...base, events: base.events.map((event) => ({ ...event, id: undefined })) } }), owner());
    expect(res.status).toBe(201);
    const { invite } = await res.json();
    expect(invite.status).toBe("draft");
    expect(invite.events.length).toBe(base.events.length);
    expect(invite.spec.events.every((e: { id?: string }) => typeof e.id === "string")).toBe(true);
    expect(invite.commonToken).toMatch(/^[A-Za-z0-9_-]{16,}$/);
  });

  it("sanitises copy and falls back to AA colours on save", async () => {
    const base = await specOf(FREE);
    const dirty = {
      ...base,
      headline: "Pay <script>alert(1)</script> <b>now</b>",
      palette: { background: "#ffffff", surface: "#ffffff", accent: "#ffffff", text: "#ffffff" },
    };
    const res = await handleUpdateInvite(req({ spec: dirty }, "PUT"), owner(), FREE);
    const { invite, warnings } = await res.json();
    expect(invite.spec.headline).not.toMatch(/<|>/); // markup is stripped; the host's text stays plain text
    expect(invite.spec.palette.text).not.toBe("#ffffff");
    expect(warnings.some((w: string) => w.startsWith("palette-fallback"))).toBe(true);
  });

  it("rejects malformed specs without touching the stored one", async () => {
    const before = await specOf(FREE);
    for (const spec of [{}, { ...before, template: "evil" }, { ...before, events: [] }, "nope", null]) {
      const res = await handleUpdateInvite(req({ spec }, "PUT"), owner(), FREE);
      expect(res.status).toBe(400);
    }
    expect(await specOf(FREE)).toEqual(before);
  });

  it("rejects an image or music asset that does not belong to the invite", async () => {
    const base = await specOf(FREE);
    const spec = { ...base, image: { assetId: "11111111-1111-4111-8111-111111111111", alt: "" } };
    expect((await handleUpdateInvite(req({ spec }, "PUT"), owner(), FREE)).status).toBe(400);
  });

  it("another host cannot read, update, publish, add guests to or set a slug on my invite", async () => {
    const before = await specOf(FREE);
    const intruder = ctxFor(OTHER);
    expect((await handleUpdateInvite(req({ spec: { ...before, headline: "Hijacked" } }, "PUT"), intruder, FREE)).status).toBe(404);
    expect((await handleSetStatus(req({ status: "draft" }), intruder, FREE)).status).toBe(404);
    expect((await handleAddGuests(req({ guests: [{ name: "Spy", maxPartySize: 1 }] }), intruder, FREE)).status).toBe(404);
    expect((await handleSetSlug(req({ slug: "stolen-link" }, "PUT"), intruder, PAID)).status).toBe(404);
    expect(await repo.getInvite(OTHER.id, FREE)).toBeNull();
    expect(await repo.listGuests(OTHER.id, FREE)).toBeNull();
    expect(await repo.listInvites(OTHER.id)).toEqual([]);
    expect(await specOf(FREE)).toEqual(before);
  });

  it("publishes and unpublishes", async () => {
    const res = await handleSetStatus(req({ status: "draft" }), owner(), FREE);
    expect((await res.json()).invite.status).toBe("draft");
    expect((await handleSetStatus(req({ status: "bogus" }), owner(), FREE)).status).toBe(400);
  });
});

describe("guests and plan limits", () => {
  const many = (n: number) => ({ guests: Array.from({ length: n }, (_, i) => ({ name: `Guest ${i}`, maxPartySize: 2 })) });

  it("enforces the free guest cap from config and allows unlimited on paid", async () => {
    const existing = (await repo.listGuests(FIXTURE_USER.id, FREE))!.length;
    const room = PLANS.free.guestCap! - existing;
    expect((await handleAddGuests(req(many(room)), owner(), FREE)).status).toBe(201);
    const over = await handleAddGuests(req(many(1)), owner(), FREE);
    expect(over.status).toBe(403);
    expect((await over.json()).error).toMatchObject({ code: "plan_limit", cap: PLANS.free.guestCap });

    const paidRes = await handleAddGuests(req(many(PLANS.free.guestCap! + 5)), owner(), PAID);
    expect(paidRes.status).toBe(201);
  });

  it("issues unguessable, unique personal tokens", async () => {
    const res = await handleAddGuests(req(many(5)), owner(), PAID);
    const tokens = (await res.json()).guests.map((g: { token: string }) => g.token);
    expect(new Set(tokens).size).toBe(5);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{21}$/);
  });

  it("rejects bad phone numbers and oversized batches", async () => {
    expect((await handleAddGuests(req({ guests: [{ name: "A", phone: "abc", maxPartySize: 1 }] }), owner(), PAID)).status).toBe(400);
    expect((await handleAddGuests(req(many(201)), owner(), PAID)).status).toBe(400);
  });
});

describe("custom slug", () => {
  it("is a paid feature and must be unique", async () => {
    expect((await handleSetSlug(req({ slug: "royal-wedding" }, "PUT"), owner(), FREE)).status).toBe(403);
    expect((await handleSetSlug(req({ slug: "royal-wedding" }, "PUT"), owner(), PAID)).status).toBe(200);
    expect((await handleSetSlug(req({ slug: "Bad Slug!" }, "PUT"), owner(), PAID)).status).toBe(400);
    // A second paid invite cannot take the same slug.
    await repo.setSlug(FIXTURE_USER.id, FREE, "royal-wedding").then((r) => expect(r).toBe("taken"));
  });
});

describe("asset uploads", () => {
  const blobs = new Map<string, { bytes: number; contentType: string }>();
  const storage: AssetStorage = {
    createUpload: async (path) => ({ strategy: "direct", url: `/upload/${path}` }),
    stat: async (path) => blobs.get(path) ?? null,
    remove: async (path) => void blobs.delete(path),
    download: async () => null,
  };
  beforeEach(() => blobs.clear());

  it("only signs small WebP images and short audio, for your own invite", async () => {
    const ok = await handleSignUpload(req({ kind: "image", contentType: "image/webp", bytes: 500_000 }), owner(), storage, FREE);
    expect(ok.status).toBe(200);
    expect((await ok.json()).target.url).toContain(`${FIXTURE_USER.id}/${FREE}/`);
    expect((await handleSignUpload(req({ kind: "image", contentType: "image/svg+xml", bytes: 1000 }), owner(), storage, FREE)).status).toBe(400);
    expect((await handleSignUpload(req({ kind: "image", contentType: "image/webp", bytes: 50_000_000 }), owner(), storage, FREE)).status).toBe(413);
    expect((await handleSignUpload(req({ kind: "image", contentType: "image/webp", bytes: 1000 }), ctxFor(OTHER), storage, FREE)).status).toBe(404);
  });

  it("registers an asset only after verifying what is really in storage", async () => {
    const sign = await (await handleSignUpload(req({ kind: "image", contentType: "image/webp", bytes: 1000 }), owner(), storage, FREE)).json();
    const confirmBody = { assetId: sign.assetId, kind: "image", contentType: "image/webp" };

    // Nothing uploaded yet.
    expect((await handleConfirmUpload(req(confirmBody), owner(), storage, FREE)).status).toBe(400);

    // The client lied: it uploaded a huge file under the signed path.
    const path = `${FIXTURE_USER.id}/${FREE}/${sign.assetId}.webp`;
    blobs.set(path, { bytes: 99_000_000, contentType: "image/webp" });
    expect((await handleConfirmUpload(req(confirmBody), owner(), storage, FREE)).status).toBe(400);
    expect(blobs.has(path)).toBe(false); // and it was deleted

    blobs.set(path, { bytes: 1200, contentType: "image/webp" });
    const done = await handleConfirmUpload(req(confirmBody), owner(), storage, FREE);
    expect(done.status).toBe(201);
    expect((await repo.getInvite(FIXTURE_USER.id, FREE))!.assets.map((a) => a.id)).toContain(sign.assetId);

    // The registered asset can now be referenced by the spec.
    const spec = { ...(await specOf(FREE)), image: { assetId: sign.assetId, alt: "Couple" } };
    expect((await handleUpdateInvite(req({ spec }, "PUT"), owner(), FREE)).status).toBe(200);
  });
});
