"use client";

import { useRef } from "react";

import { eventTypes, greeting as greetingCopy, viewer } from "@/copy/en";
import { designFor } from "@/lib/spec/designs";
import { renderGreeting } from "@/lib/spec/greeting";

import { Motif, ornamentFor } from "./book/art";
import { Book, titleClass } from "./book/Book";
import { themeFor, themeVars } from "./book/theme";
import { Countdown } from "./Countdown";
import { useTextEffects } from "./effects";
import { EventsSection } from "./EventsSection";
import { MusicButton, type MusicControl } from "./MusicButton";
import { OrnamentDivider } from "./ornaments";
import { RsvpSection } from "./RsvpSection";
import {
  displayFontClass,
  paletteVars,
  TEMPLATE_STYLES,
  templatePattern,
  templatePatternPosition,
  templatePatternSize,
  type TemplateStyle,
} from "./templates";
import type { InviteRendererProps } from "./types";

/** First letters of the hosts for the monogram shown when there is no hero image. */
function monogram(hosts: string[]): string {
  return hosts
    .slice(0, 2)
    .map((h) => Array.from(h.trim())[0]?.toUpperCase() ?? "")
    .filter(Boolean)
    .join(" & ");
}

function frameClass(frame: TemplateStyle["frame"] | "circle"): string {
  switch (frame) {
    case "circle":
      return "rounded-full border-2 border-inv-accent";
    case "arch":
      return "rounded-t-[999px] rounded-b-xl border border-inv-accent";
    case "soft-arch":
      return "rounded-t-[7rem] rounded-b-3xl border border-inv-accent";
    case "double":
      return "rounded-md border border-inv-accent outline outline-1 outline-offset-4 outline-inv-accent/60";
  }
}

function HeadlineText({ text }: { text: string }) {
  const { Headline } = useTextEffects();
  return Headline ? <Headline text={text} /> : <>{text}</>;
}

function GreetingText({ text }: { text: string }) {
  const { Greeting } = useTextEffects();
  return Greeting ? <Greeting text={text} /> : <>{text}</>;
}

/**
 * Pure invitation renderer. Same output for the guest viewer, the builder preview and
 * (later) a self-contained HTML export. All text is rendered as React text nodes, so it is
 * escaped; nothing from the spec is ever treated as HTML.
 */
export function InviteRenderer({
  spec,
  guestName,
  assets,
  watermark = false,
  online = true,
  now,
  actions,
  rsvp,
  AnimationLayer,
  preview = false,
  layout = "scroll",
  className = "",
}: InviteRendererProps) {
  const style = TEMPLATE_STYLES[spec.template] ?? TEMPLATE_STYLES.royal_ivory!;
  const design = designFor(spec.eventType, spec.template);
  const book = layout === "book";
  // The book uses the template's own look; the long-page layout keeps the spec's typography and palette.
  const displayFont = book ? titleClass(design.titleFont) : displayFontClass(spec.typography);
  const ornament = book ? ornamentFor(design.corner) : style.ornament;
  const greetingText = renderGreeting(spec.greetingTemplate, guestName);
  const firstEvent = [...spec.events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const eventLabel = eventTypes[spec.eventType] ?? eventTypes.custom;

  const musicControl = useRef<MusicControl | null>(null);
  const hasPhoto = Boolean(assets?.imageUrl);
  const heroFrame = book ? design.frame : style.frame;

  const introEl = (
    <>
      <header className="flex w-full flex-col items-center gap-5">
        {book && !hasPhoto && (
          <div className="w-full max-w-[17rem]" data-testid="hero-art">
            <Motif id={design.motif} mono={monogram(spec.hosts).replace(/ /g, "")} />
          </div>
        )}
        {(!book || hasPhoto) && (
        <div
          className={`relative w-full ${book ? "max-w-[11rem]" : "max-w-[18rem]"} overflow-hidden bg-inv-surface ${frameClass(heroFrame)}`}
          data-testid="hero-frame"
        >
          {assets?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL from IndexedDB; next/image cannot optimise it
            <img
              src={assets.imageUrl}
              alt={spec.image?.alt ?? ""}
              width={576}
              height={720}
              decoding="async"
              className={`${book && design.frame === "circle" ? "aspect-square" : "aspect-4/5"} w-full object-cover`}
            />
          ) : (
            <div className={`flex aspect-4/5 w-full flex-col items-center justify-center gap-3 ${displayFont}`}>
              <OrnamentDivider variant={ornament} />
              <span className="text-5xl font-semibold text-inv-accent">{monogram(spec.hosts)}</span>
              <OrnamentDivider variant={ornament} />
            </div>
          )}
        </div>
        )}

        <p className={`font-sans text-xs font-semibold uppercase ${style.eyebrowTracking} text-inv-text`}>
          {eventLabel}
        </p>

        <h1
          data-testid="headline"
          className={`${displayFont} text-balance text-[2.5rem] leading-[1.05] font-semibold text-inv-text sm:text-5xl`}
        >
          <HeadlineText text={spec.headline} />
        </h1>

        {spec.subheadline && (
          <p className="max-w-sm text-balance font-sans text-base leading-relaxed text-inv-text">{spec.subheadline}</p>
        )}

        {spec.hosts.length > 0 && (
          <p className={`${displayFont} text-2xl font-medium text-inv-accent`}>
            <span className="sr-only">{viewer.hostedBy} </span>
            {spec.hosts.join(" & ")}
          </p>
        )}
      </header>

      <OrnamentDivider variant={ornament} />

      <p data-testid="guest-greeting" className="font-script text-balance text-4xl leading-tight font-semibold text-inv-text">
        <GreetingText text={greetingText} />
      </p>

      {firstEvent && <Countdown startsAt={firstEvent.startsAt} now={now} />}

    </>
  );

  const detailsEl = (
    <>
      {book && (
        <p className="font-sans text-xs font-bold tracking-[0.22em] text-muted-ink uppercase">{viewer.joinUs}</p>
      )}
      <EventsSection events={spec.events} online={online} actions={actions} preview={preview} />

      {spec.closingNote && (
        <>
          <OrnamentDivider variant={ornament} />
          <p className={`${displayFont} max-w-sm text-balance text-2xl leading-snug font-medium text-inv-text`}>
            {spec.closingNote}
          </p>
        </>
      )}

    </>
  );

  const rsvpEl = (
    <>
      {rsvp && <RsvpSection controller={rsvp} />}

      {watermark && (
        <p data-testid="watermark" className="font-sans text-xs tracking-wide text-inv-text/80">
          {viewer.watermark}
        </p>
      )}
    </>
  );

  const card = (
    <article className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-5 pt-12 pb-16 text-center">
      {introEl}
      {detailsEl}
      {rsvpEl}
    </article>
  );

  const guestLabel = guestName?.trim() ? guestName.trim() : greetingCopy.genericGuestName;

  if (book) {
    const names = spec.hosts.length > 0 ? spec.hosts.join(" & ") : spec.headline;
    const bookEl = (
      <Book
        theme={themeFor(spec)}
        design={design}
        // The editor's preview has no animation layer, but should still show the card moving.
        animated={preview ? spec.displayMode === "animated" : Boolean(AnimationLayer)}
        embedded={preview}
        startPage={preview ? 1 : 0}
        cover={{
          eyebrow: `${eventLabel} ${eventLabel.toLowerCase().includes("invitation") ? "" : "invitation"}`.trim(),
          mono: monogram(spec.hosts).replace(/ /g, "") || Array.from(spec.headline)[0]?.toUpperCase() || "",
          names,
          line: spec.subheadline ?? "",
        }}
        intro={introEl}
        details={detailsEl}
        rsvp={rsvpEl}
        onOpen={() => musicControl.current?.play()}
        endPage={<OrnamentDivider variant={ornament} />}
        className={className}
      />
    );
    return (
      <>
        {AnimationLayer ? (
          <AnimationLayer spec={spec} guestName={guestLabel} skipIntro>
            {bookEl}
          </AnimationLayer>
        ) : (
          bookEl
        )}
        {assets?.audioUrl && spec.music && (
          <div data-theme={themeFor(spec)} style={themeVars}>
            <MusicButton src={assets.audioUrl} title={spec.music.title} disabled={preview} controlRef={musicControl} />
          </div>
        )}
      </>
    );
  }

  return (
    <div
      data-invite-root=""
      data-template={spec.template}
      data-typography={spec.typography}
      className={`relative isolate min-h-dvh w-full overflow-x-hidden bg-inv-bg text-inv-text ${className}`}
      style={{
        ...paletteVars(spec.palette),
        backgroundImage: templatePattern(spec.template),
        backgroundSize: templatePatternSize(spec.template),
        backgroundPosition: templatePatternPosition(spec.template),
      }}
    >
      {AnimationLayer ? (
        <AnimationLayer spec={spec} guestName={guestLabel}>
          {card}
        </AnimationLayer>
      ) : (
        card
      )}
      {assets?.audioUrl && spec.music && <MusicButton src={assets.audioUrl} title={spec.music.title} disabled={preview} />}
    </div>
  );
}
