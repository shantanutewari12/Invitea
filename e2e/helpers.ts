import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { viewer } from "../src/copy/en";
import { FIXTURE_TOKENS } from "../src/lib/data/fixtures";

export const TOKENS = FIXTURE_TOKENS;
export const inviteUrl = (token: string) => `/i/${token}`;

/** File names of the lazy (animation) chunks of the guest viewer in the current build. */
export function animationChunkNames(): string[] {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "viewer", "manifest.json"), "utf8")) as {
    lazyJs: string[];
  };
  const names = manifest.lazyJs.map((url) => url.split("/").pop() as string);
  if (names.length === 0) throw new Error("The viewer build has no lazy chunk: animation code is not split out.");
  return names;
}

/** Every file of the guest viewer bundle (shell excluded): JS, CSS and fonts. */
export function viewerBundleFiles(): string[] {
  const manifest = JSON.parse(readFileSync(join(process.cwd(), "public", "viewer", "manifest.json"), "utf8")) as {
    initialJs: string[];
    lazyJs: string[];
    css: string[];
    fonts: string[];
  };
  return [...manifest.initialJs, ...manifest.lazyJs, ...manifest.css, ...manifest.fonts];
}

/** Records which scripts the PAGE itself requested (service worker precache fetches are not page requests). */
export function trackPageScripts(page: Page): { urls: string[]; requested: (names: string[]) => string[] } {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") urls.push(decodeURIComponent(request.url()));
  });
  return { urls, requested: (names) => urls.filter((url) => names.some((name) => url.includes(name))) };
}

/** The "Saved for offline" chip only appears once the data is stored AND the service worker is active. */
export async function waitForSavedOffline(page: Page): Promise<void> {
  await expect(page.getByTestId("saved-offline")).toBeVisible({ timeout: 30_000 });
}

/** The invitation opens as a book: tap the cover (after the loader) to reach the pages. */
export async function openBookIfClosed(page: Page): Promise<void> {
  const cover = page.getByTestId("cover-open-button");
  await cover.or(page.getByTestId("guest-greeting")).first().waitFor({ state: "visible", timeout: 20_000 });
  if (await cover.isVisible()) {
    await cover.click();
    await expect(cover).toHaveCount(0, { timeout: 15_000 });
  }
}
export const openIfGated = openBookIfClosed;

/** Turn to the RSVP page (next-page arrow on desktop spreads, page dots on phones). */
export async function goToRsvp(page: Page): Promise<void> {
  const form = page.getByTestId("rsvp-form");
  if (await form.isVisible()) return;
  const next = page.getByRole("button", { name: "Next page" });
  if (await next.isVisible()) await next.click();
  else await page.getByRole("button", { name: "Page 4" }).click();
  await expect(form).toBeVisible();
}
export async function resetServerState(request: APIRequestContext): Promise<void> {
  const res = await request.delete("/api/e2e/state");
  expect(res.ok()).toBeTruthy();
}

export interface ServerState {
  rsvpRequestLog: { guestId: string; idempotencyKey: string; outcome: string }[];
  rsvps: Record<string, { status: string; partySize: number; message: string }>;
  opens: Record<string, number>;
}

export async function serverState(request: APIRequestContext): Promise<ServerState> {
  const res = await request.get("/api/e2e/state");
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as ServerState;
}

export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
}

export { viewer };
