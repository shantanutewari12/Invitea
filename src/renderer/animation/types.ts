import type { ComponentType, ReactNode } from "react";

import type { AnimationIntensity, AnimationPresetId } from "@/lib/spec/constants";
import type { InviteSpec } from "@/lib/spec/schema";

/** Every whitelisted animation preset is a typed component with this contract. */
export interface PresetProps {
  spec: InviteSpec;
  /** Display name for the greeting ("Honoured Guest" on the common link). */
  guestName: string;
  intensity: AnimationIntensity;
  /** The rendered invitation card. */
  children: ReactNode;
}

export type PresetComponent = ComponentType<PresetProps>;

export type PresetRegistry = Record<AnimationPresetId, PresetComponent>;

/** Intro presets gate the card behind a tap; ambient presets decorate it. */
export const INTRO_PRESETS: readonly AnimationPresetId[] = ["gate_open", "envelope_reveal"];
