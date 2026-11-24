"use client";

import { m } from "framer-motion";
import { useMemo } from "react";

import type { PresetProps } from "../types";

/** Deterministic pseudo-random in [0,1) from an index, so petals are stable between renders. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function petalCount(intensity: PresetProps["intensity"]): number {
  const base = intensity === "rich" ? 16 : 7;
  // Fewer particles on low-end devices.
  const cores = typeof navigator !== "undefined" ? (navigator.hardwareConcurrency ?? 4) : 4;
  return cores <= 4 ? Math.ceil(base / 2) : base;
}

/** Gentle petals drift down over the card. Purely decorative and pointer-transparent. */
export function PetalsFall({ intensity, children }: PresetProps) {
  const petals = useMemo(
    () =>
      Array.from({ length: petalCount(intensity) }, (_, i) => ({
        id: i,
        left: rand(i + 1) * 100,
        size: 10 + rand(i + 7) * 12,
        duration: 9 + rand(i + 13) * 8,
        delay: rand(i + 21) * 8,
        drift: (rand(i + 29) - 0.5) * 80,
        spin: 180 + rand(i + 37) * 360,
      })),
    [intensity],
  );

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden="true" data-testid="petals-layer">
        {petals.map((p) => (
          <m.svg
            key={p.id}
            viewBox="0 0 24 24"
            width={p.size}
            height={p.size}
            className="absolute -top-8 text-inv-accent opacity-70"
            style={{ left: `${p.left}%` }}
            initial={{ y: -40, x: 0, rotate: 0 }}
            animate={{ y: "110vh", x: p.drift, rotate: p.spin }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "linear" }}
          >
            <path d="M12 2C7 7 5 12 12 22c7-10 5-15 0-20z" fill="currentColor" />
          </m.svg>
        ))}
      </div>
    </>
  );
}
