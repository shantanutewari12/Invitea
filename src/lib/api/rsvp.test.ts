import { beforeEach, describe, expect, it } from "vitest";

import { createFixtureRepo, getFixtureState, resetFixtureState } from "@/lib/data/fixture-repo";
import { FIXTURE_TOKENS } from "@/lib/data/fixtures";
import type { InviteRepo } from "@/lib/data/types";

import { handleCommonRsvp, handleRsvp } from "./rsvp";

let repo: InviteRepo;
beforeEach(() => {
  resetFixtureState();
  repo = createFixtureRepo();
});

const KEY_A = "11111111-aaaa-4aaa-8aaa-111111111111";
const KEY_B = "22222222-bbbb-4bbb-8bbb-222222222222";

function post(token: string, key: string | null, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["idempotency-key"] = key;
  return handleRsvp(
    new Request(`http://localhost/api/invites/by-token/${token}/rsvp`, {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    token,
    repo,
  );
}

const submission = (over: Record<string, unknown> = {}) => ({
  status: "yes",
  partySize: 2,
  message: "Congratulations!",
  clientSubmittedAt: "2030-01-01T10:00:00.000Z",
  ...over,
});

describe("POST /api/invites/by-token/[token]/rsvp", () => {
  it("creates an RSVP once; replays with the same Idempotency-Key do nothing", async () => {
    const first = await post(FIXTURE_TOKENS.alice, KEY_A, submission());
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, outcome: "created" });

    for (let i = 0; i < 3; i++) {
      const replay = await post(FIXTURE_TOKENS.alice, KEY_A, submission());
      expect(replay.status).toBe(200);
      expect(await replay.json()).toEqual({ ok: true, outcome: "duplicate" });
    }
    expect(getFixtureState().rsvps.size).toBe(1);
  });

  it("a newer reply replaces the old one; a delayed older reply is ignored", async () => {
    await post(FIXTURE_TOKENS.alice, KEY_A, submission({ status: "yes", clientSubmittedAt: "2030-01-01T10:00:00.000Z" }));
    const newer = await post(FIXTURE_TOKENS.alice, KEY_B, submission({ status: "no", partySize: 0, clientSubmittedAt: "2030-01-01T11:00:00.000Z" }));
    expect((await newer.json()).outcome).toBe("updated");

    // The first reply's retry arrives late with its original key: it must not resurrect "yes".
    const late = await post(FIXTURE_TOKENS.alice, KEY_A, submission({ status: "yes", clientSubmittedAt: "2030-01-01T10:00:00.000Z" }));
    expect((await late.json()).outcome).toBe("stale");
    expect(getFixtureState().rsvps.get("g-alice")?.status).toBe("no");
  });

  it("requires a valid Idempotency-Key", async () => {
    expect((await post(FIXTURE_TOKENS.alice, null, submission())).status).toBe(400);
    expect((await post(FIXTURE_TOKENS.alice, "short", submission())).status).toBe(400);
    expect((await post(FIXTURE_TOKENS.alice, "has spaces and !!! chars here", submission())).status).toBe(400);
  });

  it("validates the body", async () => {
    expect((await post(FIXTURE_TOKENS.alice, KEY_A, "not json")).status).toBe(400);
    expect((await post(FIXTURE_TOKENS.alice, KEY_A, submission({ status: "perhaps" }))).status).toBe(400);
    expect((await post(FIXTURE_TOKENS.alice, KEY_A, submission({ partySize: -4 }))).status).toBe(400);
    expect((await post(FIXTURE_TOKENS.alice, KEY_A, submission({ message: "x".repeat(5000) }))).status).toBe(413);
  });

  it("enforces the guest's party size limit", async () => {
    const res = await post(FIXTURE_TOKENS.bob, KEY_A, submission({ partySize: 3 })); // Bob may bring 2
    expect(res.status).toBe(422);
    expect(getFixtureState().rsvps.size).toBe(0);
  });

  it("only personal tokens can RSVP: not the common link, not unknown or draft tokens", async () => {
    for (const token of [FIXTURE_TOKENS.common, "fx_unknown_Zzzzzzzzzzzzz", FIXTURE_TOKENS.unpublished]) {
      const res = await post(token, KEY_A, submission());
      expect(res.status).toBe(404);
    }
    expect(getFixtureState().rsvps.size).toBe(0);
  });

  it("one guest's token can only ever write that guest's RSVP", async () => {
    await post(FIXTURE_TOKENS.alice, KEY_A, submission({ status: "yes" }));
    await post(FIXTURE_TOKENS.bob, KEY_B, submission({ status: "no", partySize: 0 }));
    const { rsvps } = getFixtureState();
    expect(rsvps.get("g-alice")?.status).toBe("yes");
    expect(rsvps.get("g-bob")?.status).toBe("no");
    expect(rsvps.size).toBe(2);
  });
});

describe("POST /api/invites/by-token/[token]/respond (shared link)", () => {
  const reply = (token: string, body: unknown) =>
    handleCommonRsvp(
      new Request(`http://localhost/api/invites/by-token/${token}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      token,
      repo,
    );

  it("adds the guest by name and records the reply for the host", async () => {
    const before = getFixtureState().guests.length;
    const res = await reply(FIXTURE_TOKENS.common, { name: "Neha Rao", status: "yes", partySize: 2, message: "See you!" });
    expect(res.status).toBe(200);
    const state = getFixtureState();
    expect(state.guests.length).toBe(before + 1);
    const guest = state.guests.at(-1)!;
    expect(guest.name).toBe("Neha Rao");
    expect(state.rsvps.get(guest.id)).toMatchObject({ status: "yes", partySize: 2 });
  });

  it("needs a name, a sane party size, and a shared (not personal) link", async () => {
    expect((await reply(FIXTURE_TOKENS.common, { name: "", status: "yes", partySize: 1 })).status).toBe(400);
    expect((await reply(FIXTURE_TOKENS.common, { name: "A", status: "yes", partySize: 40 })).status).toBe(400);
    expect((await reply(FIXTURE_TOKENS.alice, { name: "A", status: "yes", partySize: 1 })).status).toBe(404);
    expect((await reply(FIXTURE_TOKENS.unpublished, { name: "A", status: "yes", partySize: 1 })).status).toBe(404);
  });
});
