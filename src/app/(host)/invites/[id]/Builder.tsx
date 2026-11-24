"use client";

import Link from "next/link";
import { lazy, Suspense, useMemo, useState } from "react";

import { Field, Segmented, Select, Textarea } from "@/components/host/fields";
import { DeleteInviteButton } from "@/components/host/DeleteInviteButton";
import { uploadAsset } from "@/components/host/upload";
import { StepHeader } from "@/components/paper";
import { BUILT_IN_MUSIC } from "@/config/music";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  animations,
  builder,
  common,
  create,
  displayMode as displayCopy,
  intensity as intensityCopy,
  eventTypes,
  typography,
} from "@/copy/en";
import { track } from "@/lib/analytics";
import type { HostInvite } from "@/lib/host/types";
import { checkPalette, TEMPLATE_PALETTES, type Palette } from "@/lib/spec/contrast";
import {
  ANIMATION_INTENSITIES,
  ANIMATION_PRESET_IDS,
  DISPLAY_MODES,
  LIMITS,
  TYPOGRAPHY_IDS,
} from "@/lib/spec/constants";
import type { InviteEvent, InviteSpec } from "@/lib/spec/schema";
import { isoToLocalInput, localDateTimeToIso } from "@/lib/spec/time";
import { TemplatePicker } from "@/components/host/TemplatePicker";
import { InviteRenderer } from "@/renderer/InviteRenderer";
import type { AnimationLayerProps } from "@/renderer/types";
import { cn } from "@/lib/utils";

// The same lazy boundary the guest viewer uses: static previews never load this chunk.
const LazyAnimationLayer = lazy(() => import("@/renderer/animation/AnimationLayer"));

function PreviewAnimation(props: AnimationLayerProps) {
  return (
    <Suspense fallback={props.children}>
      <LazyAnimationLayer {...props} />
    </Suspense>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function Builder({ invite, isNew = false }: { invite: HostInvite; isNew?: boolean }) {
  const [spec, setSpec] = useState<InviteSpec>(invite.spec);
  const [status, setStatus] = useState(invite.status);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notes, setNotes] = useState<string[]>([]);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [replay, setReplay] = useState(0);
  const [hostsText, setHostsText] = useState(invite.spec.hosts.join(", "));
  const [busy, setBusy] = useState<"image" | "audio" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = saveState !== "saved";
  const paletteOk = useMemo(() => checkPalette(spec.palette).ok, [spec.palette]);

  function change(patch: Partial<InviteSpec>) {
    setSpec((current) => ({ ...current, ...patch }));
    setSaveState("idle");
  }

  function changeEvent(index: number, patch: Partial<InviteEvent>) {
    change({ events: spec.events.map((event, i) => (i === index ? { ...event, ...patch } : event)) });
  }

  async function save(): Promise<boolean> {
    setSaveState("saving");
    setError(null);
    try {
      const response = await fetch(`/api/invites/${invite.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      if (!response.ok) throw new Error("save");
      const data = (await response.json()) as { invite: HostInvite; warnings: string[] };
      setSpec(data.invite.spec);
      setHostsText(data.invite.spec.hosts.join(", "));
      setNotes(data.warnings.some((w) => w.startsWith("palette-fallback")) ? [builder.contrastNote] : []);
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      setError(builder.saveFailed);
      return false;
    }
  }

  async function togglePublish() {
    setBusy("publish");
    setError(null);
    if (dirty && !(await save())) return setBusy(null);
    const next = status === "published" ? "draft" : "published";
    const response = await fetch(`/api/invites/${invite.id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (response.ok) {
      setStatus(next);
      if (next === "published") track("invite_published", { event_type: spec.eventType, display_mode: spec.displayMode });
    } else setError(builder.saveFailed);
    setBusy(null);
  }

  async function upload(kind: "image" | "audio", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      const asset = await uploadAsset(invite.id, kind, file);
      if (kind === "image") change({ image: { assetId: asset.id, alt: spec.image?.alt ?? "" } });
      else change({ music: { assetId: asset.id, title: spec.music?.title || file.name.replace(/\.[^.]+$/, "").slice(0, 80) } });
    } catch (e) {
      setError(e instanceof Error && e.message === "too_large" ? builder.uploadTooLarge : builder.uploadFailed);
    }
    setBusy(null);
  }

  async function chooseBuiltInMusic() {
    setBusy("audio");
    setError(null);
    try {
      const blob = await (await fetch(BUILT_IN_MUSIC.url)).blob();
      const file = new File([blob], `${BUILT_IN_MUSIC.title}.mp3`, { type: "audio/mpeg" });
      const asset = await uploadAsset(invite.id, "audio", file);
      change({ music: { assetId: asset.id, title: BUILT_IN_MUSIC.title } });
    } catch {
      setError(builder.uploadFailed);
    }
    setBusy(null);
  }

  const assetUrl = (assetId: string) => `/api/invites/${invite.id}/assets/${assetId}`;
  const animated = spec.displayMode === "animated";

  const palette = spec.palette;
  const colourFields: { key: keyof Palette; label: string }[] = [
    { key: "background", label: builder.colourBackground },
    { key: "surface", label: builder.colourSurface },
    { key: "accent", label: builder.colourAccent },
    { key: "text", label: builder.colourText },
  ];

  const editor = (
    <div className="flex flex-col gap-6">
      <Card className="gap-4 p-4">
        <h2 className="font-display text-xl font-semibold">{builder.displayMode}</h2>
        <Segmented
          name={builder.displayMode}
          value={spec.displayMode}
          onChange={(displayMode) => change({ displayMode })}
          options={DISPLAY_MODES.map((value) => ({
            value,
            label: displayCopy[value],
            hint: displayCopy[value === "animated" ? "animatedHint" : "staticHint"],
          }))}
        />
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-display text-xl font-semibold">{builder.content}</h2>
        <Field id="hosts" label={builder.hosts}>
          <Input
            id="hosts"
            className="h-11"
            value={hostsText}
            maxLength={200}
            onChange={(e) => {
              setHostsText(e.target.value);
              const hosts = e.target.value.split(",").map((h) => h.trim()).filter(Boolean).slice(0, LIMITS.hostsMax);
              if (hosts.length > 0) change({ hosts });
            }}
          />
        </Field>
        <Field id="headline" label={builder.headline}>
          <Input id="headline" className="h-11" value={spec.headline} maxLength={LIMITS.headline} onChange={(e) => change({ headline: e.target.value })} />
        </Field>
        <Field id="subheadline" label={builder.subheadline}>
          <Textarea id="subheadline" value={spec.subheadline} maxLength={LIMITS.subheadline} onChange={(e) => change({ subheadline: e.target.value })} />
        </Field>
        <Field id="greeting" label={builder.greeting} hint={builder.greetingHint}>
          <Input id="greeting" className="h-11" value={spec.greetingTemplate} maxLength={LIMITS.greeting} onChange={(e) => change({ greetingTemplate: e.target.value })} />
        </Field>
        <Field id="closing" label={builder.closingNote}>
          <Textarea id="closing" value={spec.closingNote} maxLength={LIMITS.closingNote} onChange={(e) => change({ closingNote: e.target.value })} />
        </Field>
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-display text-xl font-semibold">{builder.design}</h2>
        <Field id="template" label={builder.template}>
          <TemplatePicker
            eventType={spec.eventType}
            value={spec.template}
            onChange={(id) => change({ template: id, palette: { ...TEMPLATE_PALETTES[id] } })}
            text={{
              eyebrow: `${eventTypes[spec.eventType]} invitation`,
              mono: spec.hosts.map((h) => Array.from(h.trim())[0]?.toUpperCase() ?? "").join("") || "A&M",
              names: spec.hosts.length > 0 ? spec.hosts.join(" & ") : spec.headline,
              line: "",
            }}
          />
        </Field>
        <Field id="colours" label={builder.colours}>
          <div className="grid grid-cols-2 gap-2">
            {colourFields.map(({ key, label }) => (
              <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-2 text-sm">
                <input
                  type="color"
                  aria-label={label}
                  value={palette[key]}
                  onChange={(e) => change({ palette: { ...palette, [key]: e.target.value.toLowerCase() } })}
                  className="size-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                {label}
              </label>
            ))}
          </div>
          {!paletteOk && (
            <p role="status" className="text-sm text-destructive" data-testid="contrast-warning">
              {builder.contrastLive}
            </p>
          )}
          <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => change({ palette: { ...TEMPLATE_PALETTES[spec.template] } })}>
            {builder.resetColours}
          </Button>
        </Field>
        <Field id="typography" label={builder.typography}>
          <Segmented
            name={builder.typography}
            value={spec.typography}
            onChange={(value) => change({ typography: value })}
            options={TYPOGRAPHY_IDS.map((value) => ({ value, label: typography[value].name }))}
          />
        </Field>
        <Field id="animation" label={builder.animation} hint={animations[spec.animation.preset].blurb}>
          <Select id="animation" value={spec.animation.preset} onChange={(e) => change({ animation: { ...spec.animation, preset: e.target.value as InviteSpec["animation"]["preset"] } })}>
            {ANIMATION_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {animations[id].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="intensity" label={builder.intensity}>
          <Segmented
            name={builder.intensity}
            value={spec.animation.intensity}
            onChange={(value) => change({ animation: { ...spec.animation, intensity: value } })}
            options={ANIMATION_INTENSITIES.map((value) => ({ value, label: intensityCopy[value] }))}
          />
        </Field>
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-display text-xl font-semibold">{builder.image}</h2>
        <input
          type="file"
          accept="image/*"
          aria-label={builder.uploadImage}
          disabled={busy === "image"}
          onChange={(e) => {
            void upload("image", e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-gold file:bg-card file:px-4"
        />
        {busy === "image" && <p className="text-sm text-muted-foreground">{builder.uploading}</p>}
        {spec.image && (
          <>
            <Field id="imageAlt" label={builder.imageAlt}>
              <Input id="imageAlt" className="h-11" value={spec.image.alt} maxLength={LIMITS.imageAlt} onChange={(e) => change({ image: { assetId: spec.image!.assetId, alt: e.target.value } })} />
            </Field>
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => change({ image: null })}>
              {builder.removeImage}
            </Button>
          </>
        )}
        <h2 className="font-display text-xl font-semibold">{builder.music}</h2>
        <Button type="button" variant="gold" className="self-start" disabled={busy === "audio"} onClick={() => void chooseBuiltInMusic()}>
          {builder.builtInMusic}
        </Button>
        <input
          type="file"
          accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg"
          aria-label={builder.uploadMusic}
          disabled={busy === "audio"}
          onChange={(e) => {
            void upload("audio", e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-sm file:mr-3 file:min-h-11 file:rounded-full file:border file:border-gold file:bg-card file:px-4"
        />
        {busy === "audio" && <p className="text-sm text-muted-foreground">{builder.uploading}</p>}
        {spec.music && (
          <>
            <Field id="musicTitle" label={builder.musicTitle}>
              <Input id="musicTitle" className="h-11" value={spec.music.title} maxLength={LIMITS.musicTitle} onChange={(e) => change({ music: { assetId: spec.music!.assetId, title: e.target.value } })} />
            </Field>
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => change({ music: null })}>
              {builder.removeMusic}
            </Button>
          </>
        )}
      </Card>

      <Card className="gap-4 p-4">
        <h2 className="font-display text-xl font-semibold">{builder.events}</h2>
        {spec.events.map((event, index) => (
          <fieldset key={event.id ?? index} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <Field id={`event-title-${index}`} label={builder.eventTitle}>
              <Input id={`event-title-${index}`} className="h-11" value={event.title} maxLength={LIMITS.eventTitle} onChange={(e) => changeEvent(index, { title: e.target.value })} />
            </Field>
            <Field id={`event-start-${index}`} label={builder.startsAt}>
              <Input
                id={`event-start-${index}`}
                type="datetime-local"
                className="h-11"
                value={isoToLocalInput(event.startsAt, event.timezone)}
                onChange={(e) => {
                  const iso = localDateTimeToIso(e.target.value, event.timezone);
                  if (iso) changeEvent(index, { startsAt: iso });
                }}
              />
            </Field>
            <Field id={`event-venue-${index}`} label={builder.venue}>
              <Input id={`event-venue-${index}`} className="h-11" value={event.venueName} maxLength={LIMITS.venueName} onChange={(e) => changeEvent(index, { venueName: e.target.value })} />
            </Field>
            <Field id={`event-address-${index}`} label={builder.address}>
              <Textarea id={`event-address-${index}`} className="min-h-16" value={event.address} maxLength={LIMITS.address} onChange={(e) => changeEvent(index, { address: e.target.value })} />
            </Field>
            <Field id={`event-map-${index}`} label={builder.mapUrl}>
              <Input id={`event-map-${index}`} type="url" className="h-11" value={event.mapUrl} maxLength={500} onChange={(e) => changeEvent(index, { mapUrl: e.target.value })} />
            </Field>
            {spec.events.length > 1 && (
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => change({ events: spec.events.filter((_, i) => i !== index) })}>
                {builder.removeEvent}
              </Button>
            )}
          </fieldset>
        ))}
        {spec.events.length < LIMITS.eventsMax && (
          <Button
            type="button"
            variant="gold"
            className="self-start"
            onClick={() => {
              const last = spec.events[spec.events.length - 1];
              change({ events: [...spec.events, { ...last, id: undefined, title: builder.addEvent, venueName: "", address: "", mapUrl: "" }] });
            }}
          >
            {builder.addEvent}
          </Button>
        )}
      </Card>
    </div>
  );

  const preview = (
    <div className="flex flex-col items-center gap-3 lg:sticky lg:top-4">
      <div className="flex w-full max-w-[390px] items-center justify-between">
        <p className="text-sm font-semibold">
          {builder.preview} · {displayCopy[spec.displayMode]}
        </p>
        {animated && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setReplay((n) => n + 1)}>
            {builder.replay}
          </Button>
        )}
      </div>
      <div className="relative isolate h-[640px] transform-gpu w-full max-w-[390px] overflow-y-auto rounded-3xl border border-gold shadow-lg" data-testid="preview-frame">
        <InviteRenderer
          key={`${spec.displayMode}-${spec.animation.preset}-${spec.animation.intensity}-${replay}`}
          spec={spec}
          guestName={builder.sampleGuest}
          assets={{
            imageUrl: spec.image ? assetUrl(spec.image.assetId) : null,
            audioUrl: spec.music ? assetUrl(spec.music.assetId) : null,
          }}
          watermark={!invite.paid}
          rsvp={{ mode: "preview", maxPartySize: 2, previous: null, result: "idle" }}
          AnimationLayer={animated ? PreviewAnimation : undefined}
          preview
          layout="book"
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isNew && (
          <div className="w-full">
            <StepHeader step={4} total={4} />
          </div>
        )}
        <h1 className="font-display text-3xl font-semibold">{isNew ? create.reviewTitle : builder.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground" role="status" data-testid="save-state">
            {saveState === "saving" ? common.saving : dirty ? builder.unsaved : builder.saved}
          </span>
          <Button type="button" variant="outline" onClick={() => void save()} disabled={!dirty || saveState === "saving"}>
            {builder.save}
          </Button>
          <Button type="button" onClick={() => void togglePublish()} disabled={busy === "publish"}>
            {status === "published" ? builder.unpublish : builder.publish}
          </Button>
          <DeleteInviteButton inviteId={invite.id} redirectTo="/dashboard" />
          <Link href={`/invites/${invite.id}/share`} className={buttonVariants({ variant: "gold" })}>
            {builder.goToShare}
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="publish-note">
        {status === "published" ? builder.publishedNote : builder.draftNote}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notes.map((note) => (
        <p key={note} role="status" className="text-sm text-primary">
          {note}
        </p>
      ))}

      <div className="lg:hidden">
        <Segmented
          name="view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "edit", label: builder.tabEdit },
            { value: "preview", label: builder.tabPreview },
          ]}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className={cn(tab === "preview" && "hidden lg:block")}>{editor}</div>
        <div className={cn(tab === "edit" && "hidden lg:block")}>{preview}</div>
      </div>
    </div>
  );
}
