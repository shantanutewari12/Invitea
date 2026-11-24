import { expect, test } from "@playwright/test";

import { rsvp as rsvpCopy } from "../src/copy/en";

import {
  animationChunkNames,
  goOffline,
  goOnline,
  inviteUrl,
  goToRsvp,
  openBookIfClosed,
  openIfGated,
  resetServerState,
  serverState,
  TOKENS,
  trackPageScripts,
  viewer,
  viewerBundleFiles,
  waitForSavedOffline,
} from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetServerState(request);
});

test.describe("offline after one online open", () => {
  test("animated invite: hard reload in airplane mode still shows the guest's name", async ({ page, context }) => {
    await page.goto(inviteUrl(TOKENS.alice));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Alice Sharma");
    await waitForSavedOffline(page);

    await goOffline(context);
    await page.reload();
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Alice Sharma");
    await expect(page.getByTestId("offline-badge")).toBeVisible();
    await expect(page.getByTestId("headline")).toBeVisible();

    // The lazy animation chunk is in the precache, so the animated experience works offline too.
    await openIfGated(page);
    await expect(page.getByTestId("event-card").first()).toBeVisible();
    await expect(page.getByTestId("countdown")).toBeVisible();
  });

  test("static invite: hard reload in airplane mode still shows the guest's name", async ({ page, context }) => {
    await page.goto(inviteUrl(TOKENS.carol));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Carol D'Souza");
    await waitForSavedOffline(page);

    await goOffline(context);
    await page.reload();
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Carol D'Souza");
    await expect(page.getByTestId("offline-badge")).toBeVisible();
    await goToRsvp(page);
    await expect(page.getByTestId("watermark")).toBeVisible(); // free plan fixture
  });

  test("the service worker precaches the whole viewer bundle (incl. animation chunks) and nothing from the host app", async ({
    page,
  }) => {
    await page.goto(inviteUrl(TOKENS.alice));
    await waitForSavedOffline(page);
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
      }
      return urls;
    });

    expect(cached).toContain("/viewer/shell.html");
    expect(cached).toContain("/icons/192");
    for (const file of viewerBundleFiles()) expect(cached, file).toContain(file);
    for (const file of animationChunkNames()) expect(cached.some((url) => url.endsWith(file))).toBe(true);
    expect(cached.filter((url) => url.startsWith("/_next/"))).toEqual([]);
  });

  test("a brand new tab opens the saved invitation offline", async ({ page, context }) => {
    await page.goto(inviteUrl(TOKENS.alice));
    await waitForSavedOffline(page);
    await goOffline(context);

    const fresh = await context.newPage();
    await fresh.goto(inviteUrl(TOKENS.alice));
    await openBookIfClosed(fresh);
    await expect(fresh.getByTestId("guest-greeting")).toContainText("Alice Sharma");
  });

  test("offline: address text is shown, map link is not; calendar and copy still work", async ({ page, context }) => {
    await page.goto(inviteUrl(TOKENS.carol));
    await waitForSavedOffline(page);
    await openBookIfClosed(page);
    await expect(page.getByTestId("map-link").first()).toBeVisible();

    await goOffline(context);
    await page.reload();
    await openBookIfClosed(page);
    await expect(page.getByTestId("event-address").first()).toContainText("Lake Road");
    await expect(page.getByTestId("map-link")).toHaveCount(0);
    await expect(page.getByTestId("map-offline-hint").first()).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByTestId("add-to-calendar").first().click();
    expect((await download).suggestedFilename()).toMatch(/\.ics$/);
  });

  test("a link never opened online shows the friendly 'open once with internet' screen", async ({ page, context }) => {
    // The service worker and shell are installed by opening ANOTHER invitation...
    await page.goto(inviteUrl(TOKENS.alice));
    await waitForSavedOffline(page);
    await goOffline(context);

    // ...but Bob's link was never opened on this device, so there is nothing to show.
    await page.goto(inviteUrl(TOKENS.bob));
    await expect(page.getByTestId("needs-online")).toContainText(viewer.openOnceTitle);
    await expect(page.locator("body")).not.toContainText("Alice");

    // Back online it just works.
    await goOnline(context);
    await page.reload();
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Bob Verma");
  });
});

test.describe("static mode does not load animation code", () => {
  test("static invite never requests the animation chunks", async ({ page }) => {
    const scripts = trackPageScripts(page);
    await page.goto(inviteUrl(TOKENS.carol));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Carol");
    await waitForSavedOffline(page);
    await page.reload(); // second load goes through the service worker
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Carol");

    expect(scripts.urls.length).toBeGreaterThan(0);
    expect(scripts.requested(animationChunkNames())).toEqual([]);
  });

  test("animated invite does request them (control for the test above)", async ({ page }) => {
    const scripts = trackPageScripts(page);
    await page.goto(inviteUrl(TOKENS.alice));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Alice");
    await expect.poll(() => scripts.requested(animationChunkNames()).length).toBeGreaterThan(0);
  });

  test("a guest who prefers reduced motion gets static rendering for an animated invite", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const scripts = trackPageScripts(page);
    await page.goto(inviteUrl(TOKENS.alice));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Alice Sharma");
    await expect(page.getByTestId("viewer-root")).toHaveAttribute("data-display-mode", "static");
    await expect(page.getByTestId("gate-overlay")).toHaveCount(0);
    await expect(page.getByTestId("envelope-overlay")).toHaveCount(0);
    expect(scripts.requested(animationChunkNames())).toEqual([]);
    await context.close();
  });

  test("the guest's Reduce motion switch turns animation off and on", async ({ page }) => {
    await page.goto(inviteUrl(TOKENS.alice));
    await expect(page.getByTestId("viewer-root")).toHaveAttribute("data-display-mode", "animated");
    const toggle = page.getByTestId("reduce-motion-toggle");
    await toggle.click();
    await expect(page.getByTestId("viewer-root")).toHaveAttribute("data-display-mode", "static");
    await page.reload();
    await expect(page.getByTestId("viewer-root")).toHaveAttribute("data-display-mode", "static"); // remembered
    await page.getByTestId("reduce-motion-toggle").click();
    await expect(page.getByTestId("viewer-root")).toHaveAttribute("data-display-mode", "animated");
  });
});

test.describe("RSVP", () => {
  test("an RSVP made offline syncs after reconnecting, exactly once", async ({ page, context, request }) => {
    await page.goto(inviteUrl(TOKENS.alice));
    await waitForSavedOffline(page);

    await goOffline(context);
    await page.reload();
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Alice Sharma");
    await goToRsvp(page);

    await page.getByTestId("rsvp-status-yes").check({ force: true });
    await page.getByRole("button", { name: "Increase guests" }).click();
    await page.getByRole("textbox").fill("Can't wait!");
    await page.getByTestId("rsvp-submit").click();
    await expect(page.getByTestId("rsvp-result")).toHaveText(rsvpCopy.queuedOffline);

    // Nothing reached the server while offline.
    expect((await serverState(request)).rsvpRequestLog).toHaveLength(0);

    await goOnline(context);
    await expect(page.getByTestId("rsvp-result")).toHaveText(rsvpCopy.syncedLater, { timeout: 30_000 });

    // Let any other trigger (Background Sync, app-open) have its chance to double-send.
    await page.reload();
    await openBookIfClosed(page);
    await goToRsvp(page);
    await expect(page.getByTestId("rsvp-previous")).toContainText(rsvpCopy.statusYes);
    await page.waitForTimeout(1500);

    const state = await serverState(request);
    expect(state.rsvpRequestLog).toHaveLength(1);
    expect(state.rsvpRequestLog[0].outcome).toBe("created");
    expect(Object.keys(state.rsvps)).toEqual(["g-alice"]);
    expect(state.rsvps["g-alice"]).toMatchObject({ status: "yes", partySize: 2, message: "Can't wait!" });
  });

  test("an RSVP made online is sent immediately and remembered offline", async ({ page, context, request }) => {
    await page.goto(inviteUrl(TOKENS.carol));
    await waitForSavedOffline(page);
    await openBookIfClosed(page);
    await goToRsvp(page);
    await page.getByTestId("rsvp-status-no").check({ force: true });
    await page.getByTestId("rsvp-submit").click();
    await expect(page.getByTestId("rsvp-result")).toHaveText(rsvpCopy.sentOnline);

    const state = await serverState(request);
    expect(state.rsvpRequestLog).toHaveLength(1);
    expect(state.rsvps["g-carol"]).toMatchObject({ status: "no", partySize: 0 });

    await goOffline(context);
    await page.reload();
    await openBookIfClosed(page);
    await goToRsvp(page);
    await expect(page.getByTestId("rsvp-previous")).toBeVisible();
  });
});

test.describe("privacy between guests", () => {
  test("each token shows only its own guest and events", async ({ page, request }) => {
    await page.goto(inviteUrl(TOKENS.bob));
    await openBookIfClosed(page);
    await expect(page.getByTestId("guest-greeting")).toContainText("Bob Verma");
    await expect(page.getByTestId("event-card")).toHaveCount(1); // Bob is invited to the reception only
    await expect(page.locator("body")).not.toContainText("Alice");

    // The stored copy on the device contains no other guest either.
    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("regalia");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const tx = db.transaction("invites", "readonly");
      const all = await new Promise<unknown[]>((resolve) => {
        const req = tx.objectStore("invites").getAll();
        req.onsuccess = () => resolve(req.result);
      });
      db.close();
      return JSON.stringify(all);
    });
    expect(stored).toContain("Bob Verma");
    expect(stored).not.toContain("Alice");
    expect(stored).not.toContain(TOKENS.alice);

    // And the API refuses to be probed.
    for (const probe of ["fx_unknown_Zzzzzzzzzzzzz", TOKENS.unpublished, "x"]) {
      const res = await request.get(`/api/invites/by-token/${probe}`);
      expect(res.status()).toBe(404);
      expect(await res.json()).toEqual({ error: { code: "not_found" } });
    }
  });

  test("guest pages are marked noindex", async ({ request }) => {
    const res = await request.get(inviteUrl(TOKENS.alice));
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
    expect(await res.text()).toMatch(/<meta name="robots" content="noindex/);
  });
});
