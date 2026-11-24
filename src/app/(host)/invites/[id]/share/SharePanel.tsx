"use client";

import Link from "next/link";
import { useState } from "react";

import { Field, Textarea } from "@/components/host/fields";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { common, dashboard, errors, fmt, rsvp as rsvpCopy, share } from "@/copy/en";
import { track } from "@/lib/analytics";
import { parseGuestLines } from "@/lib/guests";
import { addReply, emptyCounts } from "@/lib/host/summary";
import type { HostGuest, HostInvite } from "@/lib/host/types";

import { QrButton } from "./QrButton";
import { UpgradeCard } from "./UpgradeCard";

interface Props {
  invite: HostInvite;
  initialGuests: HostGuest[];
  siteUrl: string;
  guestCap: number | null;
  price: { minor: number; label: string };
  email: string;
}

const statusLabel = { yes: rsvpCopy.statusYes, no: rsvpCopy.statusNo, maybe: rsvpCopy.statusMaybe } as const;

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? common.copied : share.copyLink}
    </Button>
  );
}

export function SharePanel({ invite, initialGuests, siteUrl, guestCap, price, email }: Props) {
  const [guests, setGuests] = useState(initialGuests);
  const [paid, setPaid] = useState(invite.paid);
  const [slug, setSlug] = useState(invite.slug);
  const [slugInput, setSlugInput] = useState(invite.slug ?? "");
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const cap = paid ? null : guestCap;
  const link = (token: string) => `${siteUrl}/i/${token}`;
  const counts = emptyCounts();
  for (const guest of guests) addReply(counts, guest.rsvp);

  async function addGuests() {
    const parsed = parseGuestLines(text);
    if (parsed.errors.length > 0) {
      return setMessage({ kind: "error", text: `${errors.invalidInput} (line ${parsed.errors.map((e) => e.line).join(", ")})` });
    }
    if (parsed.guests.length === 0) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch(`/api/invites/${invite.id}/guests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guests: parsed.guests }),
    });
    if (response.ok) {
      const data = (await response.json()) as { guests: HostGuest[] };
      setGuests((current) => [...current, ...data.guests]);
      setText("");
      track("guests_added", { count: data.guests.length });
    } else if (response.status === 403) {
      setMessage({ kind: "error", text: fmt(errors.guestCapReached, { cap: cap ?? 0 }) });
    } else {
      setMessage({ kind: "error", text: errors.invalidInput });
    }
    setBusy(false);
  }

  async function remove(guestId: string) {
    const response = await fetch(`/api/invites/${invite.id}/guests/${guestId}`, { method: "DELETE" });
    if (response.ok) setGuests((current) => current.filter((g) => g.id !== guestId));
  }

  async function saveSlug() {
    const response = await fetch(`/api/invites/${invite.id}/slug`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: slugInput.trim() || null }),
    });
    if (response.ok) {
      setSlug(slugInput.trim() || null);
      setMessage({ kind: "ok", text: share.slugSaved });
    } else {
      setMessage({ kind: "error", text: response.status === 409 ? share.slugTaken : errors.invalidInput });
    }
  }

  const whatsappHref = (guest: HostGuest) => {
    const body = fmt(share.whatsappMessage, { name: guest.name, link: link(guest.token) });
    return `https://wa.me/${guest.phone ? guest.phone.replace(/^\+/, "") : ""}?text=${encodeURIComponent(body)}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{share.title}</h1>
        <div className="flex gap-2">
          <Link href={`/invites/${invite.id}`} className={buttonVariants({ variant: "outline" })}>
            {dashboard.edit}
          </Link>
          {paid && <Badge>{share.paidBadge}</Badge>}
        </div>
      </div>

      {invite.status !== "published" && (
        <p role="status" className="rounded-lg border border-gold bg-accent p-3 text-sm" data-testid="needs-publish">
          {share.needsPublish}
        </p>
      )}
      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"}>
          {message.text}
        </p>
      )}

      <Card className="gap-3 p-4">
        <h2 className="font-display text-xl font-semibold">{share.commonLink}</h2>
        <p className="text-sm text-muted-foreground">{share.commonLinkHint}</p>
        <code className="break-all rounded bg-muted p-2 text-sm" data-testid="common-link">
          {link(slug ?? invite.commonToken)}
        </code>
        <div className="flex flex-wrap items-start gap-2">
          <CopyButton text={link(slug ?? invite.commonToken)} />
          <QrButton url={link(slug ?? invite.commonToken)} name="invitation" />
        </div>
        {paid && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Field id="slug" label={share.customSlug} hint={share.customSlugHint}>
              <div className="flex gap-2">
                <Input id="slug" className="h-11" value={slugInput} maxLength={40} onChange={(e) => setSlugInput(e.target.value.toLowerCase())} />
                <Button type="button" variant="outline" onClick={() => void saveSlug()}>
                  {common.save}
                </Button>
              </div>
            </Field>
          </div>
        )}
      </Card>

      {!paid && (
        <UpgradeCard
          inviteId={invite.id}
          price={price}
          email={email}
          onPaid={() => {
            setPaid(true);
            setMessage({ kind: "ok", text: share.paymentSuccess });
          }}
        />
      )}

      <Card className="gap-3 p-4">
        <h2 className="font-display text-xl font-semibold">{share.addGuests}</h2>
        <p className="text-sm text-muted-foreground">
          {cap === null ? share.unlimitedNote : fmt(share.guestCapNote, { used: guests.length, cap })}
        </p>
        <Field id="guest-lines" label={share.addGuests} hint={share.addGuestsHint}>
          <Textarea id="guest-lines" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        <Button type="button" className="self-start" disabled={busy || text.trim() === ""} onClick={() => void addGuests()}>
          {share.addButton}
        </Button>
      </Card>

      <Card className="gap-3 p-4">
        <h2 className="font-display text-xl font-semibold">{share.tracker}</h2>
        <p className="text-sm" data-testid="tracker-counts">
          {fmt(dashboard.replies, { ...counts })}
          {counts.yes > 0 && ` · ${fmt(dashboard.attending, { count: counts.attending })}`}
        </p>
        {guests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{share.noGuests}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {guests.map((guest) => (
              <li key={guest.id} className="flex flex-col gap-2 py-3" data-testid="guest-row">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{guest.name}</span>
                  <Badge variant="outline">{fmt(share.seats, { count: guest.maxPartySize })}</Badge>
                  <Badge variant={guest.rsvp ? "default" : "secondary"}>
                    {guest.rsvp ? `${statusLabel[guest.rsvp.status]}${guest.rsvp.status === "yes" ? ` (${guest.rsvp.partySize})` : ""}` : share.noReply}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{guest.firstOpenedAt ? share.opened : share.notOpened}</span>
                </div>
                {guest.rsvp?.message && <p className="text-sm text-muted-foreground">“{guest.rsvp.message}”</p>}
                <div className="flex flex-wrap items-start gap-2">
                  <a href={whatsappHref(guest)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "gold", size: "sm" })}>
                    {share.whatsapp}
                  </a>
                  <CopyButton text={link(guest.token)} />
                  <QrButton url={link(guest.token)} name={guest.name.replace(/[^\w-]+/g, "-")} />
                  <Button type="button" variant="ghost" size="sm" onClick={() => void remove(guest.id)}>
                    {share.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
