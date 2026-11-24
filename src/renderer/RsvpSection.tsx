"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { fmt, rsvp as rsvpCopy } from "@/copy/en";
import { RSVP_STATUSES, type RsvpStatus } from "@/lib/spec/constants";

import type { RsvpController, RsvpValues } from "./types";

const statusLabel: Record<RsvpStatus, string> = {
  yes: rsvpCopy.yes,
  no: rsvpCopy.no,
  maybe: rsvpCopy.maybe,
};

const previousLabel: Record<RsvpStatus, string> = {
  yes: rsvpCopy.statusYes,
  no: rsvpCopy.statusNo,
  maybe: rsvpCopy.statusMaybe,
};

const resultCopy: Record<string, string> = {
  sent: rsvpCopy.sentOnline,
  queued: rsvpCopy.queuedOffline,
  synced: rsvpCopy.syncedLater,
  failed: rsvpCopy.failed,
  sending: rsvpCopy.sending,
};

export function RsvpSection({ controller }: { controller: RsvpController }) {
  const { mode, maxPartySize, previous, result, onSubmit } = controller;
  const [status, setStatus] = useState<RsvpStatus>(previous?.status ?? "yes");
  const [partySize, setPartySize] = useState<number>(Math.min(Math.max(previous?.partySize ?? 1, 1), maxPartySize));
  const [message, setMessage] = useState(previous?.message ?? "");
  const [name, setName] = useState("");

  // Shared link without a way to send replies (older viewers, tests): just a note.
  if (mode === "common" && !onSubmit) {
    return (
      <section className="w-full text-center" aria-labelledby="inv-rsvp-title">
        <h2 id="inv-rsvp-title" className="font-display text-4xl font-bold text-inv-text">
          {rsvpCopy.title}
        </h2>
        <p className="mt-2 font-sans text-sm text-inv-text">{rsvpCopy.commonLinkNote}</p>
      </section>
    );
  }

  // Shared link: once this device has replied, show thanks instead of the form (no duplicate guests).
  if (mode === "common" && previous) {
    return (
      <section className="w-full text-center" aria-labelledby="inv-rsvp-title">
        <h2 id="inv-rsvp-title" className="font-display text-4xl font-bold text-inv-text">
          {rsvpCopy.title}
        </h2>
        <p data-testid="rsvp-previous" className="mt-3 font-sans text-sm text-inv-text">
          {fmt(rsvpCopy.previousReply, { status: previousLabel[previous.status] })}
        </p>
        <p data-testid="rsvp-result" role="status" className="mt-1 font-sans text-sm font-medium text-inv-text">
          {rsvpCopy.commonThanks}
        </p>
      </section>
    );
  }

  const disabled = mode === "preview";
  const sending = result === "sending";
  const countsParty = status !== "no";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (disabled || sending) return;
    const values: RsvpValues = { status, partySize: countsParty ? partySize : 0, message: message.trim() };
    if (mode === "common") values.name = name.trim();
    onSubmit?.(values);
  }

  return (
    <section className="w-full" aria-labelledby="inv-rsvp-title">
      <h2 id="inv-rsvp-title" className="mb-4 text-center font-display text-4xl font-bold text-inv-text">
        {rsvpCopy.title}
      </h2>
      {previous && (
        <p data-testid="rsvp-previous" className="mb-3 text-center font-sans text-sm text-inv-text">
          {fmt(rsvpCopy.previousReply, { status: previousLabel[previous.status] })}
        </p>
      )}
      <form
        data-testid="rsvp-form"
        onSubmit={submit}
        className="space-y-4"
      >
        {mode === "common" && (
          <label className="block">
            <span className="font-sans text-sm font-medium text-inv-text">{rsvpCopy.yourName}</span>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="rsvp-name"
              placeholder={rsvpCopy.namePlaceholder}
              className="mt-1 w-full rounded-none border-0 border-b-[1.5px] border-inv-text/50 bg-transparent px-0 py-2 font-sans text-base text-inv-text placeholder:text-inv-text/60"
            />
          </label>
        )}

        <fieldset disabled={disabled}>
          <legend className="sr-only">{rsvpCopy.title}</legend>
          <div className="grid gap-2">
            {RSVP_STATUSES.map((value) => {
              const selected = status === value;
              return (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-full border-2 px-4 font-sans text-base font-bold transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-inv-text ${
                    selected
                      ? "border-btn bg-btn text-btn-text"
                      : "border-inv-text bg-transparent text-inv-text hover:bg-inv-text/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="rsvp-status"
                    value={value}
                    checked={selected}
                    data-testid={`rsvp-status-${value}`}
                    onChange={() => setStatus(value)}
                    className="sr-only"
                  />
                  {statusLabel[value]}
                </label>
              );
            })}
          </div>
        </fieldset>

        {countsParty && maxPartySize > 1 && (
          <div className="text-center">
            <p className="font-sans text-sm font-medium text-inv-text">{rsvpCopy.partySize}</p>
            <p className="font-sans text-xs text-inv-text/80">{fmt(rsvpCopy.partySizeHint, { max: maxPartySize })}</p>
            <div className="mt-2 inline-flex items-center gap-3">
              <button
                type="button"
                disabled={disabled || partySize <= 1}
                onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                className="inline-flex size-11 items-center justify-center rounded-full border border-inv-accent text-inv-text disabled:opacity-40"
                aria-label="Decrease guests"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <output data-testid="rsvp-party-size" className="w-8 text-center font-display text-2xl font-semibold text-inv-text">
                {partySize}
              </output>
              <button
                type="button"
                disabled={disabled || partySize >= maxPartySize}
                onClick={() => setPartySize((n) => Math.min(maxPartySize, n + 1))}
                className="inline-flex size-11 items-center justify-center rounded-full border border-inv-accent text-inv-text disabled:opacity-40"
                aria-label="Increase guests"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <label className="block">
          <span className="font-sans text-sm font-medium text-inv-text">{rsvpCopy.message}</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={disabled}
            placeholder={rsvpCopy.messagePlaceholder}
            className="mt-1 w-full rounded-none border-0 border-b-[1.5px] border-inv-text/50 bg-transparent px-0 py-2 font-sans text-base text-inv-text placeholder:text-inv-text/60"
          />
        </label>

        <button
          type="submit"
          data-testid="rsvp-submit"
          disabled={disabled || sending}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-inv-text px-6 font-sans text-base font-bold text-inv-bg disabled:opacity-60"
        >
          {sending ? rsvpCopy.sending : previous ? rsvpCopy.update : rsvpCopy.submit}
        </button>

        {result !== "idle" && result !== "sending" && (
          <p data-testid="rsvp-result" role="status" className="text-center font-sans text-sm font-medium text-inv-text">
            {mode === "common" && result === "failed" ? rsvpCopy.commonFailed : resultCopy[result]}
          </p>
        )}
      </form>
    </section>
  );
}
