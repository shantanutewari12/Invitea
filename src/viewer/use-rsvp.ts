"use client";

import { useCallback, useEffect, useState } from "react";

import { MAX_PARTY_SIZE_DEFAULT } from "@/config/plans";
import type { InvitePayload } from "@/lib/invite-payload";
import { updateStoredRsvp } from "@/lib/offline/invite-store";
import { enqueueRsvp, flushOutbox, hasPendingRsvp } from "@/lib/offline/outbox";
import { registerBackgroundSync } from "@/lib/offline/service-worker";
import type { RsvpController, RsvpResult, RsvpValues } from "@/renderer/types";

/**
 * RSVP for the personal link. Every reply is written to the IndexedDB outbox first, then
 * sent right away when online. When offline it waits there and is delivered by Background
 * Sync (where supported), by the `online` event, or when the invitation is opened again.
 * The server upserts idempotently per guest, so a reply can never be recorded twice.
 */
export function useRsvp(token: string, payload: InvitePayload): RsvpController {
  const audience = payload.audience;
  const [result, setResult] = useState<RsvpResult>("idle");
  const [previous, setPrevious] = useState<RsvpValues | null>(audience.kind === "guest" ? audience.rsvp : null);

  // The loader may hand us a refreshed payload (e.g. host raised the party limit). Adjust
  // state during render when the audience changes instead of syncing it in an effect.
  const [seenAudience, setSeenAudience] = useState(audience);
  if (seenAudience !== audience) {
    setSeenAudience(audience);
    if (audience.kind === "guest") setPrevious(audience.rsvp);
  }

  useEffect(() => {
    let active = true;
    const markSynced = () =>
      setResult((current) => (current === "queued" || current === "failed" ? "synced" : current));

    // Send anything that was queued: on open, and whenever the connection returns.
    const deliverQueued = () => {
      if (!navigator.onLine) return;
      void flushOutbox().then((flushed) => {
        if (active && flushed.sentTokens.includes(token)) markSynced();
      });
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; tokens?: string[] } | null;
      if (data?.type === "regalia:rsvp-synced" && data.tokens?.includes(token)) markSynced();
    };

    deliverQueued();
    window.addEventListener("online", deliverQueued);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      active = false;
      window.removeEventListener("online", deliverQueued);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [token]);

  const onSubmit = useCallback(
    async (values: RsvpValues) => {
      setResult("sending");
      try {
        await enqueueRsvp(token, values);
        setPrevious(values);
        await updateStoredRsvp(token, values);
      } catch {
        setResult("failed");
        return;
      }

      if (navigator.onLine) {
        const flushed = await flushOutbox();
        if (flushed.sentTokens.includes(token)) {
          setResult("sent");
          return;
        }
        // Another flush may have delivered it already.
        if (!(await hasPendingRsvp(token))) {
          setResult("sent");
          return;
        }
        setResult("failed");
      } else {
        setResult("queued");
      }
      void registerBackgroundSync();
    },
    [token],
  );

  // Shared (common) link: the guest gives their name and the reply goes straight to the host (online only).
  const repliedKey = `regalia:replied:${token}`;
  const [commonPrevious, setCommonPrevious] = useState<RsvpValues | null>(() => {
    try {
      const raw = window.localStorage.getItem(repliedKey);
      return raw ? (JSON.parse(raw) as RsvpValues) : null;
    } catch {
      return null;
    }
  });
  const [commonResult, setCommonResult] = useState<RsvpResult>("idle");
  const onCommonSubmit = useCallback(
    async (values: RsvpValues) => {
      setCommonResult("sending");
      try {
        const res = await fetch(`/api/invites/by-token/${encodeURIComponent(token)}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
          credentials: "omit",
        });
        if (!res.ok) throw new Error(String(res.status));
        const saved = { status: values.status, partySize: values.partySize, message: values.message };
        setCommonPrevious(saved);
        setCommonResult("sent");
        try {
          window.localStorage.setItem(repliedKey, JSON.stringify(saved));
        } catch {
          // Private mode: the reply was still sent.
        }
      } catch {
        setCommonResult("failed");
      }
    },
    [token, repliedKey],
  );

  if (audience.kind !== "guest") {
    return { mode: "common", maxPartySize: MAX_PARTY_SIZE_DEFAULT, previous: commonPrevious, result: commonResult, onSubmit: onCommonSubmit };
  }
  return { mode: "form", maxPartySize: audience.maxPartySize, previous, result, onSubmit };
}
