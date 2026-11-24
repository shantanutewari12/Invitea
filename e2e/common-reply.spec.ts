import { expect, test } from "@playwright/test";

import { rsvp as rsvpCopy } from "../src/copy/en";

import { goToRsvp, inviteUrl, openBookIfClosed, resetServerState, TOKENS } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetServerState(request);
});

test("a guest on the shared link can say they are coming, and the host gets the reply", async ({ page, request }) => {
  await page.goto(inviteUrl(TOKENS.common));
  await openBookIfClosed(page);
  await goToRsvp(page);

  await page.getByTestId("rsvp-name").fill("Neha Rao");
  await page.getByTestId("rsvp-status-yes").check({ force: true });
  await page.getByTestId("rsvp-submit").click();
  await expect(page.getByTestId("rsvp-result")).toBeVisible();
  await expect(page.getByTestId("rsvp-previous")).toContainText(rsvpCopy.statusYes);

  const state = (await (await request.get("/api/e2e/state")).json()) as { rsvps: Record<string, { status: string }> };
  expect(Object.values(state.rsvps).some((r) => r.status === "yes")).toBe(true);

  // The same device does not get the form again (no duplicate guests).
  await page.reload();
  await openBookIfClosed(page);
  await goToRsvp(page).catch(() => undefined);
  await expect(page.getByTestId("rsvp-name")).toHaveCount(0);
});
