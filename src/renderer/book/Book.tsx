"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { fmt, viewer } from "@/copy/en";

import { type BookTheme, themeVars } from "./theme";

const DESKTOP = "(min-width: 768px)";
/** Length of the page-turn animation (see .book-leaf in tokens.css). */
const TURN_MS = 800;

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

export interface CoverText {
  eyebrow: string;
  mono: string;
  names: string;
  line: string;
}

/** The closed book: foil border, spine and a visible page-edge stack. Sizes scale with the cover so text stays inside. */
export function BookCover({ text, opening = false }: { text: CoverText; opening?: boolean }) {
  return (
    <div
      data-testid="book-cover"
      style={{ containerType: "inline-size" }}
      className={`book-cover relative aspect-[3/4] w-full max-w-[19rem] rounded-l-md rounded-r-3xl text-center ${opening ? "book-cover-open" : ""}`}
    >
      <div className="absolute inset-y-[6cqw] right-[6cqw] left-[13cqw] rounded-[4cqw] border-2 border-foil" aria-hidden="true" />
      <div className="absolute inset-y-[6cqw] right-[6cqw] left-[13cqw] flex flex-col items-center justify-center gap-[3cqw] overflow-hidden p-[4cqw]">
        <p className="font-sans font-bold uppercase" style={{ fontSize: "3.4cqw", letterSpacing: "0.12em" }}>
          {text.eyebrow}
        </p>
        <p className="font-display leading-none font-bold" style={{ fontSize: "17cqw" }}>
          {text.mono}
        </p>
        <p className="font-display leading-tight font-bold break-words text-balance" style={{ fontSize: "7cqw" }}>
          {text.names}
        </p>
        {text.line && (
          <p className="line-clamp-2 max-w-full font-sans font-semibold break-words text-balance" style={{ fontSize: "4.2cqw" }}>
            {text.line}
          </p>
        )}
      </div>
    </div>
  );
}
export function PageDots({ total, current, onGo }: { total: number; current: number; onGo: (index: number) => void }) {
  return (
    <nav aria-label="Pages" className="flex items-center justify-center">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`${viewer.pageWord} ${i + 1}`}
          aria-current={i === current ? "page" : undefined}
          onClick={() => onGo(i)}
          className="grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          <span className={`size-2 rounded-full ${i === current ? "bg-ink" : "bg-ink/30"}`} />
        </button>
      ))}
    </nav>
  );
}

const roundButton =
  "grid size-11 place-items-center rounded-full border border-desk-text/60 text-desk-text transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-text disabled:opacity-30";

/** Pages: 0 cover, 1 intro, 2 details, 3 RSVP, 4 (desktop only) the back of the RSVP leaf. */
export function Book({
  theme,
  animated,
  cover,
  intro,
  details,
  rsvp,
  endPage,
  onOpen,
  className = "",
}: {
  theme: BookTheme;
  animated: boolean;
  cover: CoverText;
  intro: ReactNode;
  details: ReactNode;
  rsvp: ReactNode;
  endPage: ReactNode;
  /** Called synchronously from the tap that opens the cover (used to start the music). */
  onOpen?: () => void;
  className?: string;
}) {
  const desktop = useIsDesktop();
  const [page, setPage] = useState(0);
  const [opening, setOpening] = useState(false);
  const [turning, setTurning] = useState(false);
  const touchX = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const content = [null, intro, details, rsvp, endPage];
  const slides = desktop ? [[0], [1, 2], [3, 4]] : [[0], [1], [2], [3]];
  const slideIndex = Math.max(0, slides.findIndex((s) => s.includes(page)));
  const slide = slides[slideIndex] ?? [0];
  const mobileTotal = 4;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  function goToSlide(target: number) {
    const next = slides[Math.min(Math.max(target, 0), slides.length - 1)]?.[0] ?? 0;
    if (next === page || turning) return;
    if (animated && desktop && slide[0] !== 0 && next !== 0) {
      setTurning(true);
      timers.current.push(window.setTimeout(() => setPage(next), TURN_MS / 2), window.setTimeout(() => setTurning(false), TURN_MS));
    } else {
      setPage(next);
    }
  }
  const step = (delta: number) => goToSlide(slideIndex + delta);

  function openCover() {
    onOpen?.();
    if (animated) {
      setOpening(true);
      timers.current.push(window.setTimeout(() => (setPage(1), setOpening(false)), 700));
    } else {
      setPage(1);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") (page === 0 ? openCover : () => step(1))();
      if (event.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const swipe = {
    onTouchStart: (e: React.TouchEvent) => void (touchX.current = e.touches[0]?.clientX ?? null),
    onTouchEnd: (e: React.TouchEvent) => {
      const start = touchX.current;
      touchX.current = null;
      const end = e.changedTouches[0]?.clientX;
      if (start === null || end === undefined || Math.abs(end - start) < 50) return;
      if (end < start) (page === 0 ? openCover : () => step(1))();
      else step(-1);
    },
  };

  const root = `relative min-h-dvh w-full overflow-x-hidden ${className}`;

  if (page === 0) {
    return (
      <div data-theme={theme} data-invite-root="" style={themeVars} className={`${root} book-desk`} {...swipe}>
        <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-16 [perspective:900px]">
          <div className="book-page-in">
            <BookCover text={cover} opening={opening} />
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              data-testid="cover-open-button"
              onClick={openCover}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-btn px-8 font-sans text-base font-bold text-btn-text shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-desk-text"
            >
              {viewer.tapToOpen}
            </button>
            <p className="font-sans text-xs font-bold text-desk-text">{viewer.swipeHint}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!desktop) {
    return (
      <div data-theme={theme} data-invite-root="" style={themeVars} className={`${root} book-page`} {...swipe}>
        <div className="book-spine relative flex min-h-dvh flex-col">
          <div
            key={page}
            data-testid={`book-page-${page}`}
            className="book-page-in flex flex-1 flex-col items-center justify-center gap-5 px-6 pt-16 pb-28 text-center"
          >
            <p className="font-sans text-xs font-bold tracking-[0.22em] text-muted-ink uppercase">
              {fmt(viewer.pageOf, { n: page + 1, total: mobileTotal })}
            </p>
            {content[page]}
          </div>
          <div className="absolute inset-x-0 bottom-4">
            <PageDots total={mobileTotal} current={page} onGo={(i) => setPage(i)} />
          </div>
          {page === 3 && (
            <div
              aria-hidden="true"
              className="absolute right-0 bottom-0 size-14"
              style={{ background: "linear-gradient(135deg, #e3d4b4 50%, var(--ink) 50%)" }}
            />
          )}
        </div>
      </div>
    );
  }

  const [left, right] = slide;
  return (
    <div data-theme={theme} data-invite-root="" style={themeVars} className={`${root} book-desk`} {...swipe}>
      <div className="flex min-h-dvh items-center justify-center px-6 py-10">
        <div className="relative w-[min(64rem,100%)]">
          <div className="relative grid min-h-[34rem] grid-cols-2 overflow-hidden rounded-xl shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)]">
            {[left, right].map((n, i) => (
              <div
                key={`${slideIndex}-${i}`}
                data-testid={`book-page-${n}`}
                className={`book-page book-page-soft ${i === 0 ? "book-gutter-left" : "book-gutter-right"} relative flex flex-col items-center justify-center gap-5 px-12 py-14 text-center`}
              >
                {content[n ?? 0]}
                <span className={`absolute bottom-4 font-sans text-xs text-muted-ink ${i === 0 ? "left-6" : "right-6"}`}>
                  {(n ?? 0) + 1}
                </span>
              </div>
            ))}
            {turning && <div aria-hidden="true" className="book-page book-leaf book-gutter-right absolute inset-y-0 right-0 w-1/2 shadow-xl" />}
          </div>
        </div>
      </div>
      <button type="button" aria-label={viewer.prevPage} onClick={() => step(-1)} className={`${roundButton} fixed top-1/2 left-5 -translate-y-1/2`}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={viewer.nextPage}
        disabled={slideIndex === slides.length - 1}
        onClick={() => step(1)}
        className={`${roundButton} fixed top-1/2 right-5 -translate-y-1/2`}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
