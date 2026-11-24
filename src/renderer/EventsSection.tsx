"use client";

import { CalendarPlus, Check, Copy, MapPin } from "lucide-react";
import { useState } from "react";

import { viewer } from "@/copy/en";
import { formatEventWhen } from "@/lib/spec/time";
import type { InviteEvent } from "@/lib/spec/schema";

import type { RendererActions } from "./types";

const actionClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-inv-accent px-4 font-sans text-sm font-medium text-inv-text transition-colors hover:bg-inv-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inv-text disabled:opacity-50";

/** Maps link: only ever built from host-provided data, and only https. */
export function mapHref(event: InviteEvent): string | null {
  if (event.mapUrl) {
    try {
      const url = new URL(event.mapUrl);
      if (url.protocol === "https:") return url.toString();
    } catch {
      /* fall through to address search */
    }
  }
  const query = [event.venueName, event.address].filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

function EventCard({
  event,
  index,
  online,
  actions,
  preview,
}: {
  event: InviteEvent;
  index: number;
  online: boolean;
  actions?: RendererActions;
  preview?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const when = formatEventWhen(event.startsAt, event.timezone);
  const hasAddress = Boolean(event.address || event.venueName);
  const map = mapHref(event);

  async function copyAddress() {
    const text = [event.venueName, event.address].filter(Boolean).join(", ");
    let ok = false;
    if (actions?.onCopyAddress) {
      const result = await actions.onCopyAddress(event, index);
      ok = result !== false;
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <li
      data-testid="event-card"
      className="rounded-2xl border border-inv-accent/70 bg-inv-surface p-5 text-center shadow-[0_1px_0_color-mix(in_srgb,var(--inv-accent)_40%,transparent)]"
    >
      <h3 className="font-display text-2xl font-semibold text-inv-text">{event.title}</h3>
      <p className="mt-2 font-sans text-sm text-inv-text">{when.date}</p>
      <p className="font-sans text-sm text-inv-text">{when.time}</p>
      {hasAddress && (
        <div className="mt-3 font-sans text-sm text-inv-text">
          {event.venueName && <p className="font-semibold">{event.venueName}</p>}
          {event.address && <p data-testid="event-address">{event.address}</p>}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          data-testid="add-to-calendar"
          className={actionClass}
          disabled={preview}
          onClick={() => actions?.onAddToCalendar?.(event, index)}
        >
          <CalendarPlus size={16} aria-hidden="true" />
          {viewer.addToCalendar}
        </button>
        {hasAddress && (
          <button type="button" data-testid="copy-address" className={actionClass} disabled={preview} onClick={copyAddress}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? viewer.addressCopied : viewer.copyAddress}
          </button>
        )}
        {hasAddress && map && online && (
          <a
            data-testid="map-link"
            className={actionClass}
            href={preview ? undefined : map}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={preview || undefined}
          >
            <MapPin size={16} aria-hidden="true" />
            {viewer.openMap}
          </a>
        )}
      </div>
      {hasAddress && map && !online && (
        <p data-testid="map-offline-hint" className="mt-3 font-sans text-xs text-inv-text/80">
          {viewer.mapOfflineHint}
        </p>
      )}
    </li>
  );
}

export function EventsSection({
  events,
  online,
  actions,
  preview,
}: {
  events: InviteEvent[];
  online: boolean;
  actions?: RendererActions;
  preview?: boolean;
}) {
  return (
    <section aria-labelledby="inv-events-title" className="w-full">
      <h2 id="inv-events-title" className="mb-4 text-center font-display text-3xl font-semibold text-inv-accent">
        {viewer.eventsTitle}
      </h2>
      <ul className="space-y-4">
        {events.map((event, index) => (
          <EventCard
            key={event.id ?? `${event.title}-${index}`}
            event={event}
            index={index}
            online={online}
            actions={actions}
            preview={preview}
          />
        ))}
      </ul>
    </section>
  );
}
