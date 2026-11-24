"use client";

import { useCallback, useEffect, useState } from "react";

import type { InvitePayload } from "@/lib/invite-payload";
import { downloadAssets, fetchInvitePayload } from "@/lib/offline/fetch-invite";
import { deleteInvite, loadStoredInvite, saveInvite, touchInvite } from "@/lib/offline/invite-store";
import { listOutbox } from "@/lib/offline/outbox";
import {
  isServiceWorkerActive,
  registerViewerServiceWorker,
  requestPersistentStorage,
} from "@/lib/offline/service-worker";

export type LoaderState =
  | { phase: "loading" }
  | { phase: "ready"; payload: InvitePayload; source: "local" | "network" }
  | { phase: "needs-online" }
  | { phase: "not-found" }
  | { phase: "error" };

export interface InviteLoader {
  state: LoaderState;
  /** True once the data (and assets) are in IndexedDB AND the service worker is active. */
  savedForOffline: boolean;
  /** Bumps whenever assets finished saving, so asset URLs can be re-resolved. */
  assetsVersion: number;
  retry: () => void;
}

const NOT_FOUND: LoaderState = { phase: "not-found" };

/** Overlay a still-queued RSVP so a background refresh never hides what the guest just sent. */
async function withPendingRsvp(token: string, payload: InvitePayload): Promise<InvitePayload> {
  if (payload.audience.kind !== "guest") return payload;
  const pending = (await listOutbox(token).catch(() => [])).filter((e) => e.state === "pending").at(-1);
  if (!pending) return payload;
  const { status, partySize, message } = pending.submission;
  return { ...payload, audience: { ...payload.audience, rsvp: { status, partySize, message } } };
}

/**
 * Offline-first loading of the invite for `/i/<token>`:
 *  1. Render from IndexedDB immediately when we have it.
 *  2. Otherwise fetch once from the API, then save the JSON + assets locally.
 *  3. When online, silently revalidate so host edits propagate.
 */
export function useInviteLoader(token: string | null): InviteLoader {
  const [state, setState] = useState<LoaderState>({ phase: "loading" });
  const [savedLocally, setSavedLocally] = useState(false);
  const [swActive, setSwActive] = useState(false);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ phase: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!token) return; // no token in the URL: the returned state below is "not-found"
    let cancelled = false;
    const controller = new AbortController();

    async function saveAll(payload: InvitePayload, etag: string | null) {
      await saveInvite(token!, payload, etag);
      // "Saved for offline" shows as soon as the data and pictures are stored; the music keeps downloading.
      const complete = await downloadAssets(token!, payload, fetch, (ok) => {
        if (!cancelled && ok) setSavedLocally(true);
      });
      if (cancelled) return;
      setAssetsVersion((n) => n + 1);
      if (complete) setSavedLocally(true);
      void requestPersistentStorage();
    }

    async function run() {
      void registerViewerServiceWorker();
      void isServiceWorkerActive().then((active) => !cancelled && setSwActive(active));

      const stored = await loadStoredInvite(token!);

      if (stored) {
        const local = await withPendingRsvp(token!, stored.payload);
        if (cancelled) return;
        setState({ phase: "ready", payload: local, source: "local" });
        // Make sure assets from an earlier, interrupted save are complete.
        void downloadAssets(token!, stored.payload, fetch, (ok) => {
          if (!cancelled && ok) setSavedLocally(true);
        }).then((complete) => {
          if (cancelled) return;
          if (complete) setSavedLocally(true);
          setAssetsVersion((n) => n + 1);
        });

        if (navigator.onLine) {
          const result = await fetchInvitePayload(token!, {
            revalidate: true,
            etag: stored.etag,
            signal: controller.signal,
          });
          if (cancelled) return;
          if (result.status === "ok") {
            await saveAll(result.payload, result.etag);
            if (cancelled) return;
            setState({ phase: "ready", payload: await withPendingRsvp(token!, result.payload), source: "network" });
          } else if (result.status === "not-modified") {
            await touchInvite(token!);
          } else if (result.status === "not-found") {
            // The host removed this guest or unpublished the invitation.
            await deleteInvite(token!);
            if (!cancelled) setState({ phase: "not-found" });
          }
        }
        return;
      }

      // Nothing saved on this device yet.
      if (!navigator.onLine) {
        setState({ phase: "needs-online" });
        return;
      }
      const result = await fetchInvitePayload(token!, { signal: controller.signal });
      if (cancelled) return;
      if (result.status === "ok") {
        setState({ phase: "ready", payload: result.payload, source: "network" });
        await saveAll(result.payload, result.etag);
      } else if (result.status === "not-found") {
        setState({ phase: "not-found" });
      } else {
        setState({ phase: navigator.onLine ? "error" : "needs-online" });
      }
    }

    run().catch(() => {
      if (!cancelled) setState((s) => (s.phase === "ready" ? s : { phase: "error" }));
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, attempt]);

  return {
    state: token ? state : NOT_FOUND,
    savedForOffline: Boolean(token) && savedLocally && swActive,
    assetsVersion,
    retry,
  };
}
