"use client";

import { Music2 } from "lucide-react";
import { type MutableRefObject, useEffect, useRef } from "react";

import { viewer } from "@/copy/en";

/** Lets the page start the music from a tap it already handles (browsers only allow sound after a tap). */
export interface MusicControl {
  play: () => void;
}

/**
 * The host's music is part of the invitation: it starts as soon as the guest opens the link and has no
 * pause or stop control. Browsers only allow sound after a tap, so if the browser blocks the first try
 * it starts on the guest's first touch, click or key press. (The editor's preview only shows a badge.)
 */
export function MusicButton({
  src,
  title,
  disabled,
  controlRef,
}: {
  src: string;
  title?: string;
  disabled?: boolean;
  controlRef?: MutableRefObject<MusicControl | null>;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const time = useRef(0);

  function start() {
    const audio = audioRef.current;
    if (!audio || disabled || !audio.paused) return;
    audio.play().catch(() => undefined);
  }
  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { play: () => startRef.current() };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  useEffect(() => {
    if (disabled) return;
    const audio = audioRef.current;
    if (!audio) return;
    const go = () => startRef.current();
    go(); // works when the browser allows autoplay (returning visitors, installed app)
    const gestures = ["pointerdown", "touchstart", "click", "keydown"] as const;
    const onGesture = () => {
      go();
      if (!audio.paused) gestures.forEach((g) => window.removeEventListener(g, onGesture, true));
    };
    gestures.forEach((g) => window.addEventListener(g, onGesture, true));
    // Nothing the guest does should leave it stopped: resume if it gets paused while the page is showing.
    const onPause = () => {
      if (!audio.ended && !document.hidden) window.setTimeout(go, 150);
    };
    const onVisible = () => {
      if (!document.hidden) go();
    };
    audio.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gestures.forEach((g) => window.removeEventListener(g, onGesture, true));
      audio.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [disabled]);

  // The source switches from the network URL to the saved copy once the offline download finishes.
  // Keep the music going from where it was instead of restarting.
  const lastSrc = useRef(src);
  useEffect(() => {
    if (lastSrc.current === src) return;
    lastSrc.current = src;
    const audio = audioRef.current;
    if (!audio || disabled) return;
    const at = time.current;
    const onReady = () => {
      audio.currentTime = at;
      audio.play().catch(() => undefined);
    };
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    return () => audio.removeEventListener("loadedmetadata", onReady);
  }, [src, disabled]);

  return (
    <>
      {disabled && (
        <span
          data-testid="music-badge"
          title={title}
          aria-label={viewer.playMusic}
          className="fixed right-4 bottom-4 z-30 inline-flex size-12 items-center justify-center rounded-full border border-inv-accent bg-inv-surface text-inv-text opacity-70 shadow-lg"
        >
          <Music2 size={20} aria-hidden="true" />
        </span>
      )}
      <audio
        ref={audioRef}
        src={src}
        autoPlay={!disabled}
        preload={src.startsWith("blob:") ? "auto" : "auto"}
        loop
        onTimeUpdate={(e) => {
          time.current = e.currentTarget.currentTime;
        }}
      />
    </>
  );
}
