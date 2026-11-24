"use client";

import { m } from "framer-motion";
import { useMemo } from "react";

import { type TextEffects, TextEffectsContext } from "@/renderer/effects";

import type { PresetProps } from "../types";

function ShimmerHeadline({ text, seconds }: { text: string; seconds: number }) {
  return (
    <m.span
      data-testid="shimmer-headline"
      style={{
        backgroundImage:
          "linear-gradient(100deg, var(--inv-text) 0%, var(--inv-text) 40%, var(--inv-accent) 50%, var(--inv-text) 60%, var(--inv-text) 100%)",
        backgroundSize: "250% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
      }}
      initial={{ backgroundPositionX: "120%" }}
      animate={{ backgroundPositionX: ["120%", "-20%"] }}
      transition={{ duration: seconds, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
    >
      {text}
    </m.span>
  );
}

/** A golden shimmer sweeps across the headline. Text stays at full contrast outside the sweep. */
export function GoldShimmer({ intensity, children }: PresetProps) {
  const seconds = intensity === "rich" ? 2.2 : 3.4;
  const effects = useMemo<TextEffects>(
    () => ({ Headline: function Headline({ text }) { return <ShimmerHeadline text={text} seconds={seconds} />; } }),
    [seconds],
  );
  return <TextEffectsContext.Provider value={effects}>{children}</TextEffectsContext.Provider>;
}
