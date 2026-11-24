"use client";

import { domAnimation, LazyMotion, MotionConfig } from "framer-motion";

import type { AnimationLayerProps } from "../types";
import { DiyaGlow } from "./presets/DiyaGlow";
import { EnvelopeReveal } from "./presets/EnvelopeReveal";
import { GateOpen } from "./presets/GateOpen";
import { GoldShimmer } from "./presets/GoldShimmer";
import { NameTypewriter } from "./presets/NameTypewriter";
import { PetalsFall } from "./presets/PetalsFall";
import { INTRO_PRESETS, type PresetRegistry } from "./types";

/**
 * Marker that exists ONLY in the animation chunk. The e2e suite asserts that static
 * mode never downloads a script containing it.
 */
export const ANIMATION_CHUNK_MARKER = "regalia-animation-chunk-v1";

/** Whitelisted presets only. An unknown id from stored data renders the plain card. */
export const PRESETS: PresetRegistry = {
  gate_open: GateOpen,
  envelope_reveal: EnvelopeReveal,
  petals_fall: PetalsFall,
  diya_glow: DiyaGlow,
  name_typewriter: NameTypewriter,
  gold_shimmer: GoldShimmer,
};

/**
 * The lazy-loaded animation entry. Uses Framer Motion's LazyMotion with the small
 * `domAnimation` feature set to keep this chunk light. Honours the OS reduced-motion setting too.
 */
export default function AnimationLayer({ spec, guestName, skipIntro, children }: AnimationLayerProps) {
  const known = Object.hasOwn(PRESETS, spec.animation.preset);
  const Preset = known && !(skipIntro && INTRO_PRESETS.includes(spec.animation.preset)) ? PRESETS[spec.animation.preset] : null;

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div data-animation-chunk={ANIMATION_CHUNK_MARKER} data-preset={spec.animation.preset}>
          {Preset ? (
            <Preset spec={spec} guestName={guestName} intensity={spec.animation.intensity}>
              {children}
            </Preset>
          ) : (
            children
          )}
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}
