"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export interface InstallPrompt {
  /** Whether to show an "Add to Home Screen" control at all. */
  available: boolean;
  /** iOS Safari has no install event; we show instructions instead. */
  needsManualSteps: boolean;
  promptInstall: () => Promise<void>;
}

const noopSubscribe = () => () => {};
const readStandalone = () =>
  Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  );
const readIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Offers "Add to Home Screen": native prompt on Chromium, manual steps on iOS Safari. */
export function useInstallPrompt(): InstallPrompt {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // Environment facts: read from the browser, assume "already installed" while hydrating.
  const standalone = useSyncExternalStore(noopSubscribe, readStandalone, () => true);
  const ios = useSyncExternalStore(noopSubscribe, readIos, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
  }, [deferred]);

  return {
    available: !standalone && (deferred !== null || ios),
    needsManualSteps: deferred === null && ios,
    promptInstall,
  };
}
