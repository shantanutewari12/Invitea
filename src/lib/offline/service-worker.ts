import { SITE } from "@/config/site";

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register(tag: string): Promise<void> };
};

export function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/**
 * Register the guest-side service worker. It is scoped to /i/ so host pages
 * (dashboard, builder) are never touched. Disabled in development.
 */
export async function registerViewerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerSupported() || process.env.NODE_ENV !== "production") return null;
  try {
    return await navigator.serviceWorker.register(SITE.swPath, {
      scope: SITE.swScope,
      updateViaCache: "none",
    });
  } catch {
    return null;
  }
}

/**
 * Resolves true once a service worker is ACTIVE for this page. The worker only
 * activates after install succeeded, which means the shell, fonts, icons and all
 * JS chunks (static and animated) are in the precache.
 */
export async function isServiceWorkerActive(timeoutMs = 20_000): Promise<boolean> {
  if (!serviceWorkerSupported() || process.env.NODE_ENV !== "production") return false;
  try {
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
    ]);
    return ready;
  } catch {
    return false;
  }
}

/** Ask the browser to retry the outbox when connectivity returns (Chromium; others use the `online` fallback). */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!serviceWorkerSupported() || process.env.NODE_ENV !== "production") return false;
  try {
    const registration = (await navigator.serviceWorker.ready) as SyncCapableRegistration;
    if (!registration.sync) return false;
    await registration.sync.register(SITE.backgroundSyncTag);
    return true;
  } catch {
    return false;
  }
}

/** Ask for durable storage so the browser does not evict the saved invitation. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
