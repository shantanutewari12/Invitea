"use client";

import { useSyncExternalStore } from "react";

import { viewer } from "@/copy/en";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds until the target (negative once passed). */
  remainingMs: number;
}

export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const remainingMs = targetMs - nowMs;
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    remainingMs,
  };
}

const DAY_MS = 86_400_000;

/** A clock that ticks once a second; the snapshot is stable within the same second. */
function subscribeToClock(onTick: () => void): () => void {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const readClockSecond = () => Math.floor(Date.now() / 1000) * 1000;
const clockOnServer = (): number | null => null;

/** Works offline: it only needs the clock and the event time already in the spec. */
export function Countdown({ startsAt, now }: { startsAt: string; now?: Date }) {
  const target = new Date(startsAt).getTime();
  const clock = useSyncExternalStore<number | null>(subscribeToClock, readClockSecond, clockOnServer);
  // `now` pins the time (previews, tests); otherwise use the live clock.
  const tick = now ? now.getTime() : clock;

  if (Number.isNaN(target) || tick === null) return <div className="h-[88px]" aria-hidden="true" />;

  const parts = countdownParts(target, tick);

  if (parts.remainingMs <= 0) {
    // Show the "has begun" message for a day, then hide the section entirely.
    if (parts.remainingMs < -DAY_MS) return null;
    return (
      <p data-testid="countdown" className="text-center font-sans text-sm font-medium tracking-wide text-inv-text">
        {viewer.countdownStarted}
      </p>
    );
  }

  const cells: [number, string][] = [
    [parts.days, viewer.countdownDays],
    [parts.hours, viewer.countdownHours],
    [parts.minutes, viewer.countdownMinutes],
    [parts.seconds, viewer.countdownSeconds],
  ];

  return (
    <section data-testid="countdown" aria-label={viewer.countdownTitle} className="mx-auto w-full max-w-xs">
      <ul className="grid grid-cols-4 gap-2">
        {cells.map(([value, label]) => (
          <li
            key={label}
            className="flex flex-col items-center rounded-xl border border-inv-accent/60 bg-inv-surface px-1 py-2"
          >
            <span className="font-display text-2xl font-semibold tabular-nums text-inv-text">
              {String(value).padStart(2, "0")}
            </span>
            <span className="font-sans text-[0.65rem] uppercase tracking-wider text-inv-text/80">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
