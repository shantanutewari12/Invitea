"use client";

import { m } from "framer-motion";

import type { PresetProps } from "../types";

/** A warm lamp glow breathes behind the card, with a tiny flame at the top. */
export function DiyaGlow({ intensity, children }: PresetProps) {
  const strong = intensity === "rich";
  return (
    <>
      <m.div
        aria-hidden="true"
        data-testid="diya-glow"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 18%, color-mix(in srgb, var(--inv-accent) 55%, transparent) 0%, transparent 62%)",
        }}
        initial={{ opacity: strong ? 0.5 : 0.3, scale: 1 }}
        animate={{ opacity: strong ? [0.5, 0.95, 0.5] : [0.3, 0.6, 0.3], scale: [1, 1.06, 1] }}
        transition={{ duration: strong ? 3.2 : 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <m.svg
        aria-hidden="true"
        viewBox="0 0 24 32"
        width="22"
        height="30"
        className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 text-inv-accent"
        animate={{ scaleY: [1, 1.12, 0.95, 1], opacity: [0.9, 1, 0.85, 0.9] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{ transformOrigin: "50% 100%" }}
      >
        <path d="M12 1c4 6 7 9 7 15a7 7 0 01-14 0c0-4 2-6 4-9 .5 2 1 3 2 3 0-3 0-6 1-9z" fill="currentColor" />
      </m.svg>
      <div className="relative z-10">{children}</div>
    </>
  );
}
