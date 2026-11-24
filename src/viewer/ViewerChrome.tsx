"use client";

import { CloudCheck, CloudOff, Download, Sparkles } from "lucide-react";
import { useState } from "react";

import { viewer } from "@/copy/en";

import type { InstallPrompt } from "./use-install-prompt";

/**
 * Small, unobtrusive controls over the invitation: connection state, the
 * "Saved for offline" confirmation, "Reduce motion" and "Add to Home Screen".
 * Rendered inside the palette wrapper so it follows the invite's colours.
 */
export function ViewerChrome({
  online,
  savedForOffline,
  reducedMotion,
  onToggleReducedMotion,
  install,
  showMotionToggle,
}: {
  online: boolean;
  savedForOffline: boolean;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  install: InstallPrompt;
  showMotionToggle: boolean;
}) {
  const [showIosSteps, setShowIosSteps] = useState(false);

  const chip =
    "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-inv-accent/70 bg-inv-surface/95 px-3 font-sans text-xs font-medium text-inv-text shadow-sm backdrop-blur";

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-wrap items-start justify-between gap-2 p-2">
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        {!online && (
          <span data-testid="offline-badge" className={chip} role="status">
            <CloudOff size={14} aria-hidden="true" />
            {viewer.offlineBadge}
          </span>
        )}
        {savedForOffline && (
          <span data-testid="saved-offline" className={chip} role="status">
            <CloudCheck size={14} aria-hidden="true" />
            {viewer.savedForOffline}
          </span>
        )}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
        {install.available && (
          <button
            type="button"
            data-testid="add-to-home-screen"
            className={chip}
            onClick={() => (install.needsManualSteps ? setShowIosSteps((v) => !v) : void install.promptInstall())}
          >
            <Download size={14} aria-hidden="true" />
            {viewer.addToHomeScreen}
          </button>
        )}
        {showMotionToggle && (
          <button
            type="button"
            data-testid="reduce-motion-toggle"
            role="switch"
            aria-checked={reducedMotion}
            className={chip}
            onClick={onToggleReducedMotion}
          >
            <Sparkles size={14} aria-hidden="true" />
            {viewer.reduceMotion}
            <span
              aria-hidden="true"
              className={`ml-1 inline-block h-4 w-7 rounded-full border border-inv-accent p-px transition-colors ${
                reducedMotion ? "bg-inv-text" : "bg-transparent"
              }`}
            >
              <span
                className={`block size-3 rounded-full transition-transform ${
                  reducedMotion ? "translate-x-3 bg-inv-bg" : "bg-inv-accent"
                }`}
              />
            </span>
          </button>
        )}
      </div>

      {showIosSteps && install.needsManualSteps && (
        <p className="pointer-events-auto w-full rounded-xl border border-inv-accent/70 bg-inv-surface p-3 text-center font-sans text-sm text-inv-text">
          {viewer.addToHomeScreenIos}
        </p>
      )}
    </div>
  );
}
