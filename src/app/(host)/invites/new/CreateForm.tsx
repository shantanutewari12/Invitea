"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { uploadAsset } from "@/components/host/upload";
import { ChipGroup, FormField, PillButton, StepHeader, underlineControl } from "@/components/paper";
import { BUILT_IN_MUSIC } from "@/config/music";
import { PLANS } from "@/config/plans";
import { builder, common, create, errors, eventTypes, fmt } from "@/copy/en";
import { track } from "@/lib/analytics";
import { parseGuestLines } from "@/lib/guests";
import { TEMPLATE_PALETTES } from "@/lib/spec/contrast";
import { buildDefaultStyle, buildInviteSpec } from "@/lib/spec/defaults";
import { EVENT_TYPES, type DisplayMode, type EventType, type TemplateId } from "@/lib/spec/constants";
import { DEFAULT_TEMPLATE_BY_EVENT, designFor, designVars, DESIGNS } from "@/lib/spec/designs";
import { InviteRenderer } from "@/renderer/InviteRenderer";

import { TemplatePicker } from "@/components/host/TemplatePicker";

const TOTAL = 4; // step 4 (review and publish) is the full editor, opened right after step 3

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

async function postJson(url: string, body: unknown, method = "POST"): Promise<Response> {
  return fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** The API only accepts https links; fix up what people paste (no scheme, or http). */
function cleanMapUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const url = /^https?:\/\//i.test(v) ? v.replace(/^http:\/\//i, "https://") : `https://${v}`;
  try {
    return new URL(url).protocol === "https:" ? url.slice(0, 500) : "";
  } catch {
    return "";
  }
}

const initials = (names: string[]) =>
  names
    .slice(0, 2)
    .map((n) => Array.from(n.trim())[0]?.toUpperCase() ?? "")
    .join("&");

/** The same phone-sized preview the editor shows, driven by what has been typed so far. */
function LivePreview({ spec }: { spec: ReturnType<typeof buildInviteSpec> | null }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-semibold">{create.livePreview}</p>
      <div
        className="relative isolate h-[560px] w-full max-w-[340px] transform-gpu overflow-y-auto rounded-3xl border border-gold bg-background shadow-lg"
        data-testid="wizard-preview"
      >
        {spec && (
          <InviteRenderer
            spec={spec}
            guestName={builder.sampleGuest}
            rsvp={{ mode: "preview", maxPartySize: 2, previous: null, result: "idle" }}
            layout="book"
            preview
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground">{create.updatesAsYouType}</p>
    </div>
  );
}

export function CreateForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [eventType, setEventType] = useState<EventType>("wedding");
  const [values, setValues] = useState({ bride: "", groom: "", hosts: "", eventTitle: "", startsAt: "", venue: "", address: "", mapUrl: "" });
  const [guestsText, setGuestsText] = useState("");
  const [picked, setPicked] = useState<TemplateId | null>(null);
  const [mode, setMode] = useState<DisplayMode>("animated");
  const [music, setMusic] = useState<"none" | "memories">("memories");
  const [busy, setBusy] = useState(false);
  const [turning, setTurning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const twoNames = eventType === "wedding" || eventType === "anniversary";
  const hosts = (twoNames ? [values.groom, values.bride] : values.hosts.split(","))
    .map((h) => h.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 4);
  const { guests, errors: guestErrors } = parseGuestLines(guestsText);
  // The template picked in step 3 (each occasion has its own set; switching occasion resets to its first).
  const template: TemplateId = picked && DESIGNS[picked].category === eventType ? picked : DEFAULT_TEMPLATE_BY_EVENT[eventType];
  const design = designFor(eventType, template);
  const names = hosts.length > 0 ? hosts.join(" & ") : "Your names";
  const coverText = { eyebrow: `${eventTypes[eventType]} invitation`, mono: initials(hosts) || "A&M", names, line: "" };

  // Local, instant version of what the generator produces, so the preview matches the editor's.
  const previewSpec = useMemo(() => {
    try {
      const style = buildDefaultStyle(eventType, hosts.length > 0 ? hosts : ["Your names"]);
      return buildInviteSpec(
        {
          eventType,
          prompt: "",
          hosts: hosts.length > 0 ? hosts : ["Your names"],
          displayMode: mode,
          events: [
            {
              title: values.eventTitle.trim(),
              startsAtLocal: values.startsAt || "2031-01-01T18:00",
              timezone: browserTimeZone(),
              venueName: values.venue.trim(),
              address: values.address.trim(),
              mapUrl: cleanMapUrl(values.mapUrl),
            },
          ],
        },
        { ...style, template, palette: { ...TEMPLATE_PALETTES[template] } },
      );
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hosts` is derived from `values`/`eventType`
  }, [eventType, values, mode, template]);

  async function importCsv(file: File) {
    const text = await file.text();
    setGuestsText(text.split(/\r?\n/).filter((line, i) => !(i === 0 && /^\W*name\b/i.test(line))).join("\n"));
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    try {
      const generated = await postJson("/api/ai/generate-invite", {
        eventType,
        prompt: "",
        hosts,
        displayMode: mode,
        events: [
          {
            title: values.eventTitle.trim(),
            startsAtLocal: values.startsAt,
            timezone: browserTimeZone(),
            venueName: values.venue.trim(),
            address: values.address.trim(),
            mapUrl: cleanMapUrl(values.mapUrl),
          },
        ],
      });
      if (generated.status === 429) throw new Error(errors.rateLimited);
      if (generated.status === 422) throw new Error(create.invalidTime);
      if (!generated.ok) {
        const detail = (await generated.json().catch(() => null)) as { error?: { fields?: string[] } } | null;
        const fields = detail?.error?.fields?.filter(Boolean) ?? [];
        throw new Error(fields.length > 0 ? `${errors.invalidInput} (${fields.join(", ")})` : errors.invalidInput);
      }
      const { spec, source } = (await generated.json()) as { spec: Record<string, unknown>; source: "ai" | "fallback" };
      // The template picked in step 3 sets the look (and its colours), like the editor's template buttons.
      spec.template = template;
      spec.palette = { ...TEMPLATE_PALETTES[template] };

      const saved = await postJson("/api/invites", { spec });
      if (!saved.ok) throw new Error(errors.server);
      const { invite } = (await saved.json()) as { invite: { id: string } };
      track("invite_created", { event_type: eventType, display_mode: mode, source });

      if (guests.length > 0) {
        const payload = (list: typeof guests) => ({ guests: list.map((g) => ({ name: g.name, phone: g.phone, maxPartySize: g.maxPartySize })) });
        const res = await postJson(`/api/invites/${invite.id}/guests`, payload(guests));
        if (res.status === 403 && PLANS.free.guestCap !== null && guests.length > PLANS.free.guestCap) {
          await postJson(`/api/invites/${invite.id}/guests`, payload(guests.slice(0, PLANS.free.guestCap)));
        }
      }

      // The built-in track becomes the invite's own audio asset, so guests get it too (offline included).
      if (music === "memories") {
        try {
          const blob = await (await fetch(BUILT_IN_MUSIC.url)).blob();
          const asset = await uploadAsset(invite.id, "audio", new File([blob], `${BUILT_IN_MUSIC.title}.mp3`, { type: "audio/mpeg" }));
          await postJson(`/api/invites/${invite.id}`, { spec: { ...spec, music: { assetId: asset.id, title: BUILT_IN_MUSIC.title } } }, "PUT");
        } catch {
          // The editor (step 4) lets the host add music again.
        }
      }

      router.push(`/invites/${invite.id}?new=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : common.somethingWentWrong);
      setBusy(false);
    }
  }

  /** Each step is a page: on wider screens the leaf turns over to the next one. */
  function goStep(target: number) {
    const flip = window.matchMedia("(min-width: 768px)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!flip) return setStep(target);
    setTurning(true);
    window.setTimeout(() => setStep(target), 400);
    window.setTimeout(() => setTurning(false), 800);
  }

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (turning) return;
    if (step < 3) goStep(step + 1);
    else void createInvite();
  };

  const stepBody =
    step === 1 ? (
      <>
        <h2 className="font-display text-3xl font-bold">{create.tellDetails}</h2>
        <ChipGroup
          name={create.eventType}
          value={eventType}
          onChange={setEventType}
          options={EVENT_TYPES.map((t) => ({ value: t, label: eventTypes[t] }))}
        />
        {twoNames ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField id="bride" label={create.bride}>
              <input id="bride" required maxLength={60} value={values.bride} onChange={set("bride")} className={underlineControl} />
            </FormField>
            <FormField id="groom" label={create.groom}>
              <input id="groom" required maxLength={60} value={values.groom} onChange={set("groom")} className={underlineControl} />
            </FormField>
          </div>
        ) : (
          <FormField id="hosts" label={create.hosts} hint={create.hostsHint}>
            <input id="hosts" required maxLength={200} value={values.hosts} onChange={set("hosts")} className={underlineControl} />
          </FormField>
        )}
        <FormField id="startsAt" label={create.startsAt}>
          <input id="startsAt" type="datetime-local" required value={values.startsAt} onChange={set("startsAt")} className={underlineControl} />
        </FormField>
        <FormField id="venue" label={create.venue}>
          <input id="venue" maxLength={120} value={values.venue} onChange={set("venue")} className={underlineControl} />
        </FormField>
        <FormField id="address" label={create.address}>
          <input id="address" maxLength={240} value={values.address} onChange={set("address")} className={underlineControl} />
        </FormField>
        <FormField id="mapUrl" label={create.mapUrl}>
          <input id="mapUrl" type="text" inputMode="url" maxLength={500} value={values.mapUrl} onChange={set("mapUrl")} className={underlineControl} />
        </FormField>
        <FormField id="eventTitle" label={create.eventTitle} hint={create.eventTitleHint}>
          <input id="eventTitle" maxLength={80} value={values.eventTitle} onChange={set("eventTitle")} className={underlineControl} />
        </FormField>
      </>
    ) : step === 2 ? (
      <>
        <h2 className="font-display text-3xl font-bold">{create.whoInvited}</h2>
        <FormField id="guests" label={create.pasteNames}>
          <textarea
            id="guests"
            rows={5}
            value={guestsText}
            onChange={(e) => setGuestsText(e.target.value)}
            placeholder={"Priya Sharma\nRohit Verma, +919812345678, 2"}
            className={underlineControl}
          />
        </FormField>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])}
        />
        <PillButton type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
          {create.importCsv}
        </PillButton>
        {guests.length > 0 && (
          <>
            <p className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
              {fmt(create.guestsShown, { total: guests.length, shown: Math.min(3, guests.length) })}
            </p>
            <ul className="divide-y divide-border">
              {guests.slice(0, 3).map((g, i) => (
                <li key={i} className="flex min-h-11 items-center justify-between text-base font-semibold">
                  {g.name}
                  <span className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">{create.linkReady}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{fmt(create.guestNote, { name: guests[0]!.name })}</p>
          </>
        )}
        {guestErrors.length > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {guestErrors.length} line(s) skipped: {guestErrors.map((g) => g.line).join(", ")}
          </p>
        )}
      </>
    ) : (
      <>
        <h2 className="font-display text-3xl font-bold">{create.chooseLook}</h2>
        <TemplatePicker eventType={eventType} value={template} onChange={setPicked} text={coverText} />
        <p className="text-xs text-muted-foreground">{create.templateNote}</p>
        <p className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">{create.motion}</p>
        <div className="grid grid-cols-2 gap-3">
          <PillButton type="button" aria-pressed={mode === "animated"} variant={mode === "animated" ? "primary" : "secondary"} onClick={() => setMode("animated")}>
            {create.pageFlip}
          </PillButton>
          <PillButton type="button" aria-pressed={mode === "static"} variant={mode === "static" ? "primary" : "secondary"} onClick={() => setMode("static")}>
            {create.simple}
          </PillButton>
        </div>
        <p className="text-xs text-muted-foreground">{create.motionNote}</p>
        <p className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">{create.music}</p>
        <ChipGroup
          name={create.music}
          value={music}
          onChange={setMusic}
          options={[
            { value: "none", label: create.musicNone },
            { value: "memories", label: create.musicMemories },
          ]}
        />
        {music === "memories" && (
          <audio controls preload="none" src={BUILT_IN_MUSIC.url} className="w-full" aria-label={create.musicMemories} />
        )}
      </>
    );

  return (
    <div style={designVars(design) as React.CSSProperties} className="desk-md rounded-3xl md:px-8 md:py-10">
      <div className="relative mx-auto w-full max-w-md md:grid md:max-w-5xl md:grid-cols-2 md:overflow-hidden md:rounded-xl md:shadow-2xl">
        <form onSubmit={next} className="book-page md-gutter-left flex flex-col gap-5 md:px-12 md:py-12" aria-busy={busy}>
          <StepHeader step={step} total={TOTAL} onBack={step > 1 && !turning ? () => goStep(step - 1) : undefined} />
          <div key={step} className="book-page-in flex flex-col gap-5">
            {stepBody}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <PillButton type="submit" disabled={busy || turning}>
            {step < 3 ? create.next : busy ? create.generating : create.generate}
          </PillButton>
        </form>
        <details className="book-page px-6 pb-8 md:hidden">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">{create.previewMobile}</summary>
          <LivePreview spec={previewSpec} />
        </details>
        <div className="book-page book-gutter-right hidden flex-col items-center justify-center px-8 py-12 md:flex">
          <LivePreview spec={previewSpec} />
        </div>
        {turning && <div aria-hidden="true" className="book-page book-leaf book-gutter-right pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 shadow-xl md:block" />}
      </div>
      <p className="mt-4 hidden text-center text-sm text-desk-text md:block">{create.bookCaption}</p>
    </div>
  );
}
