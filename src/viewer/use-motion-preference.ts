"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "regalia:reduce-motion";

/** Used when localStorage is unavailable (private mode, blocked storage). */
let memoryChoice: boolean | null = null;
const listeners = new Set<() => void>();

function readPreference(): boolean {
  if (memoryChoice !== null) return memoryChoice;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    /* storage unavailable: fall back to the OS preference */
  }
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const query = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  query?.addEventListener("change", onChange);
  window.addEventListener("storage", onChange); // another tab changed the choice
  return () => {
    listeners.delete(onChange);
    query?.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

const readOnServer = (): boolean | null => null;

/**
 * Guest-controlled "Reduce motion". Defaults to the OS `prefers-reduced-motion`
 * setting. When on, the viewer renders in static mode and never loads the animation chunk.
 * `null` while hydrating so nothing animated is started before the preference is known.
 */
export function useReducedMotion(): { reduced: boolean | null; setReduced: (value: boolean) => void } {
  const reduced = useSyncExternalStore<boolean | null>(subscribe, readPreference, readOnServer);

  const setReduced = useCallback((value: boolean) => {
    memoryChoice = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* the in-memory choice still applies for this visit */
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { reduced, setReduced };
}
