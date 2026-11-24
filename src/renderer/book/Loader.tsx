import type { CSSProperties } from "react";

import { viewer } from "@/copy/en";

import type { BookTheme, LoaderIcon } from "./theme";

function Icon({ kind, mono }: { kind: LoaderIcon; mono: string }) {
  const common = { width: 96, height: 96, viewBox: "0 0 96 96", "aria-hidden": true } as const;
  switch (kind) {
    case "cake":
      return (
        <svg {...common}>
          <path d="M48 10c4 5 4 9 0 12-4-3-4-7 0-12z" fill="#ff9a62" stroke="#2b1b3d" strokeWidth="3" />
          <rect x="44" y="22" width="8" height="12" rx="2" fill="#6cc3ff" stroke="#2b1b3d" strokeWidth="3" />
          <rect x="26" y="34" width="44" height="18" rx="6" fill="#ffc93c" stroke="#2b1b3d" strokeWidth="3" />
          <rect x="16" y="52" width="64" height="26" rx="8" fill="#ff6fa5" stroke="#2b1b3d" strokeWidth="3" />
          <path d="M20 62c6 5 10-5 16 0s10-5 16 0 10-5 16 0 6 0 8-2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case "rattle":
      return (
        <svg {...common}>
          <circle cx="48" cy="34" r="22" fill="#ffc93c" stroke="#2b1b3d" strokeWidth="3" />
          <path d="M34 34h28M48 20v28" stroke="#2b1b3d" strokeWidth="3" />
          <rect x="44" y="54" width="8" height="26" rx="4" fill="#ff6fa5" stroke="#2b1b3d" strokeWidth="3" />
          <circle cx="48" cy="84" r="6" fill="#6cc3ff" stroke="#2b1b3d" strokeWidth="3" />
        </svg>
      );
    case "house":
      return (
        <svg {...common}>
          <path d="M12 46 48 14l36 32" fill="none" stroke="#2b1b3d" strokeWidth="5" strokeLinejoin="round" />
          <rect x="20" y="44" width="56" height="36" rx="3" fill="#f0c36a" stroke="#2b1b3d" strokeWidth="3" />
          <rect x="40" y="58" width="16" height="22" rx="2" fill="#a85a1e" stroke="#2b1b3d" strokeWidth="3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="14" y="8" width="68" height="80" rx="8" fill="var(--cover)" stroke="var(--foil)" strokeWidth="3" />
          <rect x="22" y="16" width="52" height="64" rx="4" fill="none" stroke="var(--foil)" strokeWidth="2" />
          <text x="48" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--cover-text)" fontFamily="serif">
            {mono}
          </text>
        </svg>
      );
  }
}

/**
 * "Opening your invitation…": the event icon bounces 3 times (about 1.2 s) with a squash on
 * landing and a ground shadow. `still` (static mode / reduced motion) shows a resting icon.
 */
export function Loader({
  icon,
  theme,
  mono = "A&M",
  still = false,
  style,
}: {
  icon: LoaderIcon;
  theme: BookTheme;
  mono?: string;
  still?: boolean;
  /** The template's colour variables, so the loader matches the card that is about to open. */
  style?: CSSProperties;
}) {
  return (
    <main
      data-theme={theme}
      style={style}
      data-testid="viewer-message"
      role="status"
      className="book-desk flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center"
    >
      <div className="flex h-36 flex-col items-center justify-end">
        <div className={still ? "" : "book-bounce origin-bottom"}>
          <Icon kind={icon} mono={mono} />
        </div>
        <div className={`mt-2 h-3 w-24 rounded-full bg-black ${still ? "opacity-40" : "book-shadow"}`} aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-bold text-desk-text">{viewer.loadingInvite}</h1>
      <div className="flex gap-2" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-foil" />
        <span className="size-2.5 rounded-full bg-foil/60" />
        <span className="size-2.5 rounded-full bg-foil/30" />
      </div>
      <p className="font-sans text-sm font-bold text-desk-text">{viewer.savingItOffline}</p>
    </main>
  );
}
