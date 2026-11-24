import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFixtureRepo } from "@/lib/data/fixture-repo";
import { FIXTURE_IDS, FIXTURE_TOKENS } from "@/lib/data/fixtures";
import { buildInvitePayload } from "@/lib/data/payload";
import { resetFixtureState } from "@/lib/data/fixture-repo";
import type { InviteRepo, TokenLookup } from "@/lib/data/types";

import { handleAssetFetch } from "./asset";
import { handleTokenLookup } from "./by-token";

const url = (token: string, query = "") => `http://localhost/api/invites/by-token/${token}${query}`;
const get = (token: string, init?: RequestInit, query = "") => new Request(url(token, query), init);

let repo: InviteRepo;

beforeEach(() => {
  resetFixtureState();
  repo = createFixtureRepo();
});

async function body(response: Response) {
  return JSON.parse(await response.text());
}

describe("GET /api/invites/by-token/[token]", () => {
  it("returns the guest's own invitation with a personal greeting target", async () => {
    const res = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo);
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.audience).toMatchObject({ kind: "guest", guestName: "Alice Sharma", maxPartySize: 4, rsvp: null });
    expect(json.invite.spec.events).toHaveLength(2);
    expect(json.invite.displayMode).toBe("animated");
    expect(json.invite.watermark).toBe(false); // fixture invite is paid
  });

  it("never exposes another guest's data (acceptance: one token cannot expose another guest)", async () => {
    const aliceRes = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo);
    const raw = await aliceRes.text();

    // Other guests on the same invite: names, tokens, ids.
    for (const secret of ["Bob Verma", "Carol", "Drew Draft", FIXTURE_TOKENS.bob, FIXTURE_TOKENS.carol, "g-bob", "g-carol"]) {
      expect(raw).not.toContain(secret);
    }
    // No owner or guest identifiers, and no token field, are part of the response.
    expect(raw).not.toMatch(/owner|ownerId|owner_id|guestId|guest_id|invitedEventIds|"token"/i);

    const bobRes = await handleTokenLookup(get(FIXTURE_TOKENS.bob), FIXTURE_TOKENS.bob, repo);
    const bob = await body(bobRes);
    expect(JSON.stringify(bob)).not.toContain("Alice");
    expect(bob.audience.guestName).toBe("Bob Verma");
  });

  it("filters events to the ones the guest is invited to", async () => {
    const bob = await body(await handleTokenLookup(get(FIXTURE_TOKENS.bob), FIXTURE_TOKENS.bob, repo));
    expect(bob.invite.spec.events.map((e: { title: string }) => e.title)).toEqual(["Reception"]);
    const alice = await body(await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo));
    expect(alice.invite.spec.events.map((e: { title: string }) => e.title)).toEqual(["Wedding Ceremony", "Reception"]);
  });

  it("serves the common link with a generic audience and no guest data", async () => {
    const res = await handleTokenLookup(get(FIXTURE_TOKENS.common), FIXTURE_TOKENS.common, repo);
    expect(res.status).toBe(200);
    const json = await body(res);
    expect(json.audience).toEqual({ kind: "common" });
    expect(JSON.stringify(json)).not.toMatch(/Alice|Bob|Carol/);
  });

  it("returns an identical 404 for unknown, malformed, and unpublished tokens (no enumeration)", async () => {
    const unknown = await handleTokenLookup(get("fx_nonexistent_AAAAAAAAAA"), "fx_nonexistent_AAAAAAAAAA", repo);
    const malformed = await handleTokenLookup(get("short"), "short", repo);
    const injection = await handleTokenLookup(get("x"), "x' OR '1'='1", repo);
    const draft = await handleTokenLookup(get(FIXTURE_TOKENS.unpublished), FIXTURE_TOKENS.unpublished, repo);

    for (const res of [unknown, malformed, injection, draft]) {
      expect(res.status).toBe(404);
      expect(await res.text()).toBe(JSON.stringify({ error: { code: "not_found" } }));
    }
  });

  it("is private, never cached, never indexed", async () => {
    const res = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("supports conditional requests (304) for silent revalidation", async () => {
    const first = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo);
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();
    const second = await handleTokenLookup(
      get(FIXTURE_TOKENS.alice, { headers: { "if-none-match": etag } }, "?revalidate=1"),
      FIXTURE_TOKENS.alice,
      repo,
    );
    expect(second.status).toBe(304);
    expect(await second.text()).toBe("");
  });

  it("records an open for a normal request but not for background revalidation", async () => {
    const spy = vi.spyOn(repo, "recordOpen");
    await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, repo);
    expect(spy).toHaveBeenCalledTimes(1);
    await handleTokenLookup(get(FIXTURE_TOKENS.alice, undefined, "?revalidate=1"), FIXTURE_TOKENS.alice, repo);
    expect(spy).toHaveBeenCalledTimes(1);
    await handleTokenLookup(get(FIXTURE_TOKENS.common), FIXTURE_TOKENS.common, repo); // common link: no guest
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rate limits per client", async () => {
    const limited: InviteRepo = { ...repo, consumeRateLimit: async () => false };
    const res = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, limited);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("answers 500 (without details) if the datastore fails", async () => {
    const broken: InviteRepo = {
      ...repo,
      lookupToken: async () => {
        throw new Error("connection string postgres://secret");
      },
    };
    const res = await handleTokenLookup(get(FIXTURE_TOKENS.alice), FIXTURE_TOKENS.alice, broken);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret");
  });
});

describe("buildInvitePayload", () => {
  it("is a pure function of one lookup: output cannot contain data that was not in the lookup", async () => {
    const lookup = (await repo.lookupToken(FIXTURE_TOKENS.bob)) as TokenLookup;
    const payload = buildInvitePayload(lookup, FIXTURE_TOKENS.bob);
    const raw = JSON.stringify(payload);
    expect(raw).toContain("Bob Verma");
    expect(raw).not.toContain("Alice");
    expect(Object.keys(payload).sort()).toEqual(["assets", "audience", "invite", "payloadVersion"]);
    expect(Object.keys(payload.invite).sort()).toEqual(["displayMode", "id", "spec", "version", "watermark"]);
  });

  it("only lists assets the spec references and scopes their URLs to the token", async () => {
    const lookup = (await repo.lookupToken(FIXTURE_TOKENS.alice)) as TokenLookup;
    lookup.assets.push({ id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", kind: "image", contentType: "image/webp", storagePath: "x" });
    const payload = buildInvitePayload(lookup, FIXTURE_TOKENS.alice);
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0].id).toBe(FIXTURE_IDS.heroImage);
    expect(payload.assets[0].url).toBe(`/api/invites/by-token/${FIXTURE_TOKENS.alice}/assets/${FIXTURE_IDS.heroImage}`);
  });
});

describe("GET /api/invites/by-token/[token]/assets/[assetId]", () => {
  const assetReq = (token: string, id: string) =>
    new Request(`http://localhost/api/invites/by-token/${token}/assets/${id}`);

  it("streams an asset that belongs to the token's invite", async () => {
    const res = await handleAssetFetch(assetReq(FIXTURE_TOKENS.alice, FIXTURE_IDS.heroImage), FIXTURE_TOKENS.alice, FIXTURE_IDS.heroImage, repo);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(10);
  });

  it("refuses assets of another invite, unknown ids, and bad ids with the same 404", async () => {
    // Carol is on the static invite, which has no assets: she must not read Alice's invite image.
    const cross = await handleAssetFetch(assetReq(FIXTURE_TOKENS.carol, FIXTURE_IDS.heroImage), FIXTURE_TOKENS.carol, FIXTURE_IDS.heroImage, repo);
    const unknown = await handleAssetFetch(assetReq(FIXTURE_TOKENS.alice, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"), FIXTURE_TOKENS.alice, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", repo);
    const bad = await handleAssetFetch(assetReq(FIXTURE_TOKENS.alice, "../../etc/passwd"), FIXTURE_TOKENS.alice, "../../etc/passwd", repo);
    for (const res of [cross, unknown, bad]) expect(res.status).toBe(404);
  });
});
