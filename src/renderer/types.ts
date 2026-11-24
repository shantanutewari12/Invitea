import type { ComponentType, ReactNode } from "react";

import type { RsvpStatus } from "@/lib/spec/constants";
import type { InviteEvent, InviteSpec } from "@/lib/spec/schema";

/**
 * The renderer is PURE: spec JSON + resolved assets + a few flags in, UI out.
 * It never fetches, never touches IndexedDB or the network, and never imports the
 * animation code. Behaviour (RSVP sending, calendar download, copy) is injected
 * through `actions` and `rsvp`, so a single self-contained HTML export can reuse it later.
 */

export interface RendererAssets {
  /** Object URL / URL of the hero image, if the spec has one. */
  imageUrl?: string | null;
  /** Object URL / URL of the optional music track. */
  audioUrl?: string | null;
}

export interface RsvpValues {
  status: RsvpStatus;
  partySize: number;
  message: string;
  /** Only sent from the shared link, where the guest types their own name. */
  name?: string;
}

export type RsvpResult = "idle" | "sending" | "sent" | "queued" | "synced" | "failed";

export interface RsvpController {
  /** `form`: personal link. `common`: shared link (no RSVP). `preview`: builder (disabled). */
  mode: "form" | "common" | "preview";
  maxPartySize: number;
  previous: RsvpValues | null;
  result: RsvpResult;
  onSubmit?: (values: RsvpValues) => void;
}

export interface RendererActions {
  onAddToCalendar?: (event: InviteEvent, index: number) => void;
  /** Resolve true when the address was copied. */
  onCopyAddress?: (event: InviteEvent, index: number) => Promise<boolean> | boolean | void;
}

export interface AnimationLayerProps {
  spec: InviteSpec;
  guestName: string;
  /** The book has its own cover, so tap-to-open intro presets are skipped. */
  skipIntro?: boolean;
  /** The rendered invitation card; the layer decorates or gates it. */
  children: ReactNode;
}

export interface InviteRendererProps {
  spec: InviteSpec;
  /** Guest name for the greeting. Null on the common link (generic greeting). */
  guestName: string | null;
  assets?: RendererAssets;
  /** Free plan watermark. */
  watermark?: boolean;
  /** Whether the device is online (decides Map button vs address-only hint). */
  online?: boolean;
  /** Injectable clock for the countdown (tests, previews). */
  now?: Date;
  actions?: RendererActions;
  rsvp?: RsvpController;
  /**
   * Provided ONLY in animated mode (lazy-loaded by the viewer). Static mode never
   * receives it, so the Framer Motion code never loads.
   */
  AnimationLayer?: ComponentType<AnimationLayerProps>;
  /** True inside the builder preview: renders compactly and disables real side effects. */
  preview?: boolean;
  /** `book`: cover + pages (the guest viewer). `scroll`: one long page (builder preview, tests). */
  layout?: "scroll" | "book";
  className?: string;
}
