import { expect, test, type Page } from "@playwright/test";

import { auth, builder, create, dashboard, share } from "../src/copy/en";
import { openBookIfClosed, resetServerState } from "./helpers";

test.beforeEach(async ({ request }) => {
  await resetServerState(request);
});

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(auth.email).fill("host@example.com");
  await page.getByLabel(auth.password).fill("password123");
  await page.getByRole("button", { name: auth.signIn, exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function createInvite(page: Page): Promise<string> {
  await page.goto("/invites/new");
  await page.getByLabel(create.groom).fill("Aarav");
  await page.getByLabel(create.bride).fill("Meera");
  await page.getByLabel(create.startsAt).fill("2031-02-14T18:30");
  await page.getByLabel(create.venue).fill("Royal Palace Hall");
  await page.getByRole("button", { name: create.next }).click(); // guests
  await page.getByRole("button", { name: create.next }).click(); // look and motion
  await page.getByRole("button", { name: create.generate }).click();
  await expect(page).toHaveURL(/\/invites\/[0-9a-f-]{36}(\?new=1)?$/);
  await expect(page.getByTestId("preview-frame")).toBeVisible();
  return new URL(page.url()).pathname.split("/").pop()!;
}

test("the host area needs a session, and signing out ends it", async ({ page, request }) => {
  expect((await request.post("/api/invites", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/ai/generate-invite", { data: {} })).status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page);
  await expect(page.getByTestId("invite-card")).toHaveCount(3);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("create -> edit -> publish -> add a guest -> that guest's personal link opens", async ({ page, context }) => {
  await signIn(page);
  const id = await createInvite(page);

  // Builder: the preview reflects edits live, and the animated/static toggle works.
  await expect(page.getByText(`${builder.preview} · Animated`)).toBeVisible();
  await page.getByRole("radio", { name: /Static/ }).click();
  await expect(page.getByText(`${builder.preview} · Static`)).toBeVisible();
  await expect(page.getByTestId("preview-frame")).toContainText("Aarav");
  await page.getByLabel(builder.headline, { exact: true }).fill("Aarav & Meera, together at last");
  await expect(page.getByTestId("preview-frame").getByTestId("headline")).toHaveText("Aarav & Meera, together at last");
  await page.getByRole("button", { name: builder.save }).click();
  await expect(page.getByTestId("save-state")).toHaveText(builder.saved);

  // Publish.
  await page.getByRole("button", { name: builder.publish, exact: true }).click();
  await expect(page.getByTestId("publish-note")).toHaveText(builder.publishedNote);

  // Share: add a guest, get a personal link.
  await page.goto(`/invites/${id}/share`);
  await page.getByLabel(share.addGuests, { exact: true }).fill("Priya Sharma, +91 98123 45678, 3");
  await page.getByRole("button", { name: share.addButton }).click();
  const row = page.getByTestId("guest-row").filter({ hasText: "Priya Sharma" });
  await expect(row).toBeVisible();
  await expect(page.getByTestId("tracker-counts")).toContainText("1 waiting");
  expect(await row.getByRole("link", { name: share.whatsapp }).getAttribute("href")).toContain("https://wa.me/919812345678?text=");

  // QR is generated locally.
  await row.getByRole("button", { name: share.qr }).click();
  await expect(row.getByTestId("qr-panel").getByRole("img")).toBeVisible();

  // Copy the personal link out of the WhatsApp message and open it as the guest.
  const href = (await row.getByRole("link", { name: share.whatsapp }).getAttribute("href"))!;
  const link = decodeURIComponent(href.split("text=")[1]).match(/https?:\/\/\S+/)![0];
  const guest = await context.newPage();
  await guest.goto(link);
  await openBookIfClosed(guest);
  await expect(guest.getByTestId("headline")).toHaveText("Aarav & Meera, together at last");
  await expect(guest.getByText(/Priya Sharma/).first()).toBeVisible();
});

test("an unpublished invite's links do not work yet, and the free plan caps guests", async ({ page, context }) => {
  await signIn(page);
  const id = await createInvite(page);
  await page.goto(`/invites/${id}/share`);
  await expect(page.getByTestId("needs-publish")).toBeVisible();

  await page.getByLabel(share.addGuests, { exact: true }).fill("Guest One");
  await page.getByRole("button", { name: share.addButton }).click();
  await expect(page.getByTestId("guest-row")).toHaveCount(1);

  const common = (await page.getByTestId("common-link").textContent())!;
  const guest = await context.newPage();
  await guest.goto(common);
  await expect(guest.getByText("We couldn't find this invitation")).toBeVisible();

  // Free cap is 10 guests in total: 9 more fit, one more does not.
  const nine = Array.from({ length: 9 }, (_, i) => `Guest ${i + 2}`).join("\n");
  await page.getByLabel(share.addGuests, { exact: true }).fill(nine);
  await page.getByRole("button", { name: share.addButton }).click();
  await expect(page.getByTestId("guest-row")).toHaveCount(10);
  await page.getByLabel(share.addGuests, { exact: true }).fill("One Too Many");
  await page.getByRole("button", { name: share.addButton }).click();
  await expect(page.getByText(/up to 10 guests/)).toBeVisible();
  await expect(page.getByTestId("upgrade-card")).toBeVisible();
});

test("the dashboard shows the new invite as a draft with its guest counts", async ({ page }) => {
  await signIn(page);
  await createInvite(page);
  await page.goto("/dashboard");
  await expect(page.getByTestId("invite-card")).toHaveCount(4);
  // The seeded draft plus the one just created.
  await expect(page.getByTestId("invite-card").filter({ hasText: dashboard.draft })).toHaveCount(2);
});

test("a host can pick the built-in music while creating, and delete an invitation", async ({ page }) => {
  await signIn(page);
  await page.goto("/invites/new");
  await page.getByLabel(create.groom).fill("Aarav");
  await page.getByLabel(create.bride).fill("Meera");
  await page.getByLabel(create.startsAt).fill("2031-02-14T18:30");
  await page.getByRole("button", { name: create.next }).click();
  await page.getByRole("button", { name: create.next }).click();
  await page.getByRole("radio", { name: create.musicMemories }).click();
  await page.getByRole("button", { name: create.generate }).click();
  await expect(page).toHaveURL(/\/invites\/[0-9a-f-]{36}\?new=1$/);
  await expect(page.getByLabel(builder.musicTitle)).toHaveValue("Memories of Spring", { timeout: 20_000 });

  await page.goto("/dashboard");
  await expect(page.getByTestId("invite-card")).toHaveCount(4);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("invite-card").first().getByRole("button", { name: "Delete" }).click();
  await expect(page.getByTestId("invite-card")).toHaveCount(3);
});
