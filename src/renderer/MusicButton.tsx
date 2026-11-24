"use client";

import { Music2, Pause } from "lucide-react";
import { type MutableRefObject, useEffect, useRef, useState } from "react";

import { viewer } from "@/copy/en";

/** Lets the page start the music from a tap it already handles (browsers only allow sound after a tap). */
export interface MusicControl {
  play: () => void;
}

/**
 * The music starts when the guest taps "Open" on the cover (that tap is what lets the browser
 * play sound). The round button then pauses and resumes it.
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
  const [playing, setPlaying] = useState(false);
  const time = useRef(0);
  const playingRef = useRef(false);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  async function start() {
    const audio = audioRef.current;
    if (!audio || disabled || !audio.paused) return;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  useEffect(() => {
    if (!controlRef) return;
    controlRef.current = { play: () => void start() };
    return () => {
      controlRef.current = null;
    };
  });

  // The source switches from the network URL to the saved copy once the offline download finishes.
  // Keep the music going from where it was instead of restarting or stopping.
  const lastSrc = useRef(src);
  useEffect(() => {
    if (lastSrc.current === src) return;
    lastSrc.current = src;
    const audio = audioRef.current;
    if (!audio || !playingRef.current) return;
    const at = time.current;
    const onReady = () => {
      audio.currentTime = at;
      void audio.play().catch(() => setPlaying(false));
    };
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    return () => audio.removeEventListener("loadedmetadata", onReady);
  }, [src]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || disabled) return;
    if (audio.paused) await start();
    else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="music-toggle"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={playing}
        aria-label={playing ? viewer.pauseMusic : viewer.playMusic}
        title={title}
        className="fixed right-4 bottom-4 z-30 inline-flex size-12 items-center justify-center rounded-full border border-inv-accent bg-inv-surface text-inv-text shadow-lg"
      >
        {playing ? <Pause size={20} aria-hidden="true" /> : <Music2 size={20} aria-hidden="true" />}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload={src.startsWith("blob:") ? "auto" : "metadata"}
        loop
        onTimeUpdate={(e) => {
          time.current = e.currentTarget.currentTime;
        }}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}
