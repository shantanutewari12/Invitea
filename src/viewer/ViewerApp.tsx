"use client";

import { Component, lazy, type ReactNode, Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { viewer } from "@/copy/en";
import { buildIcs, downloadIcs } from "@/lib/ics";
import type { InvitePayload } from "@/lib/invite-payload";
import { designFor, designVars } from "@/lib/spec/designs";
import { inviteKeyFromPathname } from "@/lib/token-format";
import { InviteRenderer } from "@/renderer/InviteRenderer";
import { Loader } from "@/renderer/book/Loader";
import { loaderIconFor, themeFor, themeVars } from "@/renderer/book/theme";
import type { AnimationLayerProps, RendererActions } from "@/renderer/types";

import { useAssetUrls } from "./use-asset-urls";
import { useInstallPrompt } from "./use-install-prompt";
import { useInviteLoader } from "./use-invite-loader";
import { useReducedMotion } from "./use-motion-preference";
import { useOnline } from "./use-online";
import { useRsvp } from "./use-rsvp";
import { ViewerChrome } from "./ViewerChrome";
import { ViewerMessage } from "./ViewerMessage";

/**
 * The animation code (Framer Motion + presets) is a separate lazy chunk. It is only
 * requested when an invite is animated AND the guest has not reduced motion. Static mode
 * never imports it. The service worker precaches it, so animated invites also work offline.
 */
const LazyAnimationLayer = lazy(
  () => import(/* webpackChunkName: "regalia-animation" */ "@/renderer/animation/AnimationLayer"),
);

class AnimationBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Never lets a failed animation chunk break the invitation: it degrades to the static card. */
function SafeAnimationLayer(props: AnimationLayerProps) {
  return (
    <AnimationBoundary fallback={props.children}>
      <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
        <LazyAnimationLayer {...props} />
      </Suspense>
    </AnimationBoundary>
  );
}

function InviteView({
  token,
  payload,
  savedForOffline,
  assetsVersion,
}: {
  token: string;
  payload: InvitePayload;
  savedForOffline: boolean;
  assetsVersion: number;
}) {
  const online = useOnline();
  const install = useInstallPrompt();
  const { reduced, setReduced } = useReducedMotion();
  const assets = useAssetUrls(token, payload, assetsVersion);
  const rsvp = useRsvp(token, payload);
  const { spec } = payload.invite;

  // Wait for the preference before deciding, so an animated invite never starts moving
  // for a guest who asked for reduced motion.
  const motionKnown = reduced !== null;
  const animated = payload.invite.displayMode === "animated" && motionKnown && !reduced;
  const guestName = payload.audience.kind === "guest" ? payload.audience.guestName : null;

  const actions = useMemo<RendererActions>(
    () => ({
      onAddToCalendar(event, index) {
        const where = [event.venueName, event.address].filter(Boolean).join(", ");
        const ics = buildIcs({
          uid: `${payload.invite.id}-${event.id ?? index}`,
          title: event.title,
          startsAt: event.startsAt,
          location: where || undefined,
          description: spec.headline,
        });
        downloadIcs(event.title.replace(/[^\w\- ]+/g, "").trim() || "invitation", ics);
      },
      async onCopyAddress(event) {
        const text = [event.venueName, event.address].filter(Boolean).join(", ");
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          return false;
        }
      },
    }),
    [payload.invite.id, spec.headline],
  );

  // Per-invite web app manifest so "Add to Home Screen" reopens THIS invitation.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) link.href = `/i/${encodeURIComponent(token)}/manifest.webmanifest`;
  }, [token]);

  // Helps screen-readers and the browser tab title; never includes the guest's name.
  useEffect(() => {
    document.title = viewer.pageTitle;
  }, []);

  // Animated invites show the bouncing loader for about 0.6 s before the cover appears.
  const [loaderDone, setLoaderDone] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setLoaderDone(true), 600);
    return () => window.clearTimeout(id);
  }, []);

  const firstEvent = spec.events[0];
  if (!firstEvent) return null;
  const vars = designVars(designFor(spec.eventType, spec.template)) as React.CSSProperties;

  return (
    <div
      data-theme={themeFor(spec)}
      style={{ ...themeVars, ...vars }}
      data-motion={animated ? "full" : "reduced"}
      data-display-mode={animated ? "animated" : "static"}
      data-testid="viewer-root"
    >
      <ViewerChrome
        online={online}
        savedForOffline={savedForOffline}
        reducedMotion={Boolean(reduced)}
        onToggleReducedMotion={() => setReduced(!reduced)}
        install={install}
        showMotionToggle={payload.invite.displayMode === "animated"}
      />
      {!motionKnown || (animated && !loaderDone) ? (
        <Loader icon={loaderIconFor(spec.eventType)} theme={themeFor(spec)} still={!animated} style={vars} />
      ) : (
        <InviteRenderer
          layout="book"
          spec={spec}
          guestName={guestName}
          assets={assets}
          watermark={payload.invite.watermark}
          online={online}
          actions={actions}
          rsvp={rsvp}
          AnimationLayer={animated ? SafeAnimationLayer : undefined}
        />
      )}
    </div>
  );
}

/** Before the invite is known: the card icon bounces (a still icon for guests who prefer less motion). */
function LoadingScreen() {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return <Loader icon="card" theme="wedding" still={still} />;
}

const noopSubscribe = () => () => {};
const readTokenFromLocation = () => inviteKeyFromPathname(window.location.pathname);
const tokenOnServer = (): string | null | undefined => undefined;

export function ViewerApp() {
  // The cached shell is served for EVERY /i/* URL, so the token must come from the URL in
  // the browser, never from server-rendered params. `undefined` only during hydration.
  const token = useSyncExternalStore<string | null | undefined>(noopSubscribe, readTokenFromLocation, tokenOnServer);

  const loader = useInviteLoader(token === undefined ? null : token);

  if (token === undefined) return <LoadingScreen />;
  const { state } = loader;

  switch (state.phase) {
    case "loading":
      return <LoadingScreen />;
    case "needs-online":
      return <ViewerMessage title={viewer.openOnceTitle} body={viewer.openOnceBody} testId="needs-online" />;
    case "not-found":
      return <ViewerMessage title={viewer.notFoundTitle} body={viewer.notFoundBody} testId="not-found" />;
    case "error":
      return (
        <ViewerMessage
          title={viewer.errorTitle}
          body={viewer.errorBody}
          testId="load-error"
          actionLabel="Try again"
          onAction={loader.retry}
        />
      );
    case "ready":
      return (
        <InviteView
          token={token as string}
          payload={state.payload}
          savedForOffline={loader.savedForOffline}
          assetsVersion={loader.assetsVersion}
        />
      );
  }
}
