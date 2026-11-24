"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { viewer } from "@/copy/en";
import { OrnamentDivider } from "@/renderer/ornaments";
import { TEMPLATE_STYLES } from "@/renderer/templates";

import type { PresetProps } from "../types";

/** A sealed envelope opens (after a tap) and the card rises out of it. */
export function EnvelopeReveal({ spec, intensity, children }: PresetProps) {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const flap = intensity === "rich" ? 0.9 : 0.5;
  const ornament = TEMPLATE_STYLES[spec.template]?.ornament ?? "lotus";

  return (
    <>
      <div inert={!gone}>{children}</div>
      {!gone && (
        <m.div
          data-testid="envelope-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-inv-bg px-6"
          initial={{ opacity: 1 }}
          animate={open ? { opacity: 0, y: 40 } : { opacity: 1, y: 0 }}
          transition={open ? { delay: flap + 0.5, duration: 0.6 } : { duration: 0 }}
          onAnimationComplete={() => open && setGone(true)}
        >
          <div className="relative h-52 w-full max-w-xs [perspective:900px]" aria-hidden="true">
            {/* The card rising out of the envelope. */}
            <m.div
              className="absolute inset-x-4 bottom-4 top-6 rounded-md border border-inv-accent bg-inv-surface"
              animate={{ y: open ? -70 : 0 }}
              transition={{ delay: flap, duration: 0.6 }}
            >
              <div className="flex h-full items-center justify-center">
                <OrnamentDivider variant={ornament} />
              </div>
            </m.div>
            {/* Envelope body */}
            <div className="absolute inset-x-0 bottom-0 top-10 rounded-md border border-inv-accent bg-inv-surface [clip-path:polygon(0_0,50%_55%,100%_0,100%_100%,0_100%)]" />
            <div className="absolute inset-x-0 bottom-0 top-10 rounded-md border border-inv-accent" />
            {/* Flap */}
            <m.div
              className="absolute inset-x-0 top-10 h-24 origin-top border border-inv-accent bg-inv-bg [clip-path:polygon(0_0,100%_0,50%_100%)]"
              style={{ zIndex: open ? 0 : 5 }}
              animate={{ rotateX: open ? 180 : 0 }}
              transition={{ duration: flap }}
            />
          </div>
          <button
            type="button"
            data-testid="envelope-open-button"
            onClick={() => setOpen(true)}
            disabled={open}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-inv-text px-8 font-sans text-base font-semibold text-inv-bg shadow-lg"
          >
            {viewer.tapToOpen}
          </button>
        </m.div>
      )}
    </>
  );
}
