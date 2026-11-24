"use client";

import { animate, m, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useMemo } from "react";

import { type TextEffects, TextEffectsContext } from "@/renderer/effects";

import type { PresetProps } from "../types";

function TypewriterGreeting({ text, perChar }: { text: string; perChar: number }) {
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => text.slice(0, Math.round(v)));

  useEffect(() => {
    const controls = animate(count, text.length, { duration: Math.max(0.6, text.length * perChar), ease: "linear", delay: 0.4 });
    return () => controls.stop();
  }, [count, text, perChar]);

  return (
    <>
      {/* The full text is always available to assistive tech; the visual typing is decoration. */}
      <span className="sr-only">{text}</span>
      <m.span aria-hidden="true">{shown}</m.span>
      <span aria-hidden="true" className="ml-0.5 inline-block w-px animate-pulse bg-current align-middle">
        &nbsp;
      </span>
    </>
  );
}

/** The guest's greeting (with their name) is written out letter by letter. */
export function NameTypewriter({ intensity, children }: PresetProps) {
  const perChar = intensity === "rich" ? 0.07 : 0.04;
  // Stable identity: a new component type on every render would restart the typing.
  const effects = useMemo<TextEffects>(
    () => ({ Greeting: function Greeting({ text }) { return <TypewriterGreeting text={text} perChar={perChar} />; } }),
    [perChar],
  );
  return <TextEffectsContext.Provider value={effects}>{children}</TextEffectsContext.Provider>;
}
