/// <reference lib="esnext" />
/// <reference lib="webworker" />
// NOTE: relative imports only (this file is compiled by Serwist's own webpack child compiler).
import { type PrecacheEntry, Serwist, type SerwistGlobalConfig } from "serwist";

import { SITE } from "../config/site";
import { flushOutbox } from "../lib/offline/outbox";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Guest-side service worker.
 *
 * - Precaches (at install) exactly the standalone viewer bundle (public/viewer: shell, JS,
 *   CSS, fonts, including the lazy animation chunks) and the app icons. The host app's own
 *   JavaScript is never precached on a guest's phone.
 * - For any navigation to /i/*, serves the cached viewer shell. No Next.js RSC payloads are
 *   involved; the shell reads the token from the URL and loads the invite from IndexedDB.
 * - Replays queued RSVPs through Background Sync.
 *
 * Invite data itself is NOT cached here: it lives in IndexedDB (see lib/offline).
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  disableDevLogs: true,
  // No generic runtime caching: only the precache plus the navigation route below.
  runtimeCaching: [],
});

serwist.registerCapture(
  ({ request, url }) =>
    request.mode === "navigate" && url.origin === self.location.origin && url.pathname.startsWith(SITE.viewerPathPrefix),
  async ({ request }) => {
    const shell = await serwist.matchPrecache(SITE.viewerShellPath);
    if (shell) return shell;
    // Shell not precached (should not happen once installed): fall back to the network.
    return fetch(request);
  },
);

serwist.addEventListeners();

interface SyncEventLike extends ExtendableEvent {
  tag: string;
}

self.addEventListener("sync", (event) => {
  const syncEvent = event as SyncEventLike;
  if (syncEvent.tag !== SITE.backgroundSyncTag) return;
  syncEvent.waitUntil(
    (async () => {
      const result = await flushOutbox();
      if (result.sentTokens.length > 0) {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clients) {
          client.postMessage({ type: "regalia:rsvp-synced", tokens: result.sentTokens });
        }
      }
      // Rejecting makes the browser retry the sync later with backoff.
      if (result.remaining > 0) throw new Error("outbox not empty");
    })(),
  );
});
