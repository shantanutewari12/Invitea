"use client";

import { m } from "framer-motion";
import { useState } from "react";

import { viewer } from "@/copy/en";
import { OrnamentDivider } from "@/renderer/ornaments";
import { TEMPLATE_STYLES } from "@/renderer/templates";

import type { PresetProps } from "../types";

const panelStyle = {
  backgroundImage:
    "repeating-linear-gradient(90deg, transparent 0 22px, color-mix(in srgb, var(--inv-accent) 22%, transparent) 22px 23px)",
} as const;

/** Grand palace gates swing open (after a tap) to reveal the invitation. */
export function GateOpen({ spec, intensity, children }: PresetProps) {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const duration = intensity === "rich" ? 1.7 : 0.9;
  const ornament = TEMPLATE_STYLES[spec.template]?.ornament ?? "lotus";

  return (
    <>
      <div inert={!gone}>{children}</div>
      {!gone && (
        <div className="fixed inset-0 z-50 overflow-hidden" data-testid="gate-overlay">
          {(["left", "right"] as const).map((side) => (
            <m.div
              key={side}
              aria-hidden="true"
              className={`absolute inset-y-0 w-1/2 bg-inv-bg ${side === "left" ? "left-0 border-r" : "right-0 border-l"} border-inv-accent`}
              style={panelStyle}
              initial={{ x: 0 }}
              animate={{ x: open ? (side === "left" ? "-101%" : "101%") : 0 }}
              transition={{ duration, ease: [0.65, 0, 0.35, 1] }}
              onAnimationComplete={() => open && side === "left" && setGone(true)}
            >
              <div
                className={`absolute inset-y-10 ${side === "left" ? "right-4 left-6" : "right-6 left-4"} rounded-t-[999px] border border-inv-accent/70`}
              />
            </m.div>
          ))}
          <m.div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
            animate={{ opacity: open ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <OrnamentDivider variant={ornament} />
            <button
              type="button"
              data-testid="gate-open-button"
              onClick={() => setOpen(true)}
              disabled={open}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-inv-text px-8 font-sans text-base font-semibold text-inv-bg shadow-lg"
            >
              {viewer.tapToOpen}
            </button>
          </m.div>
        </div>
      )}
    </>
  );
}
