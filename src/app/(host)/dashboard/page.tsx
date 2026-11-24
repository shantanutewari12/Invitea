import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DeleteInviteButton } from "@/components/host/DeleteInviteButton";
import { Card } from "@/components/ui/card";
import { dashboard, eventTypes, fmt } from "@/copy/en";
import { getHostRepo } from "@/lib/host";
import { requireUser } from "@/lib/host/session";
import type { InviteSummary } from "@/lib/host/types";

export const metadata: Metadata = { title: "Your invitations" };

function formatWhen(iso: string | null): string {
  if (!iso) return dashboard.noDate;
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function InviteCard({ invite }: { invite: InviteSummary }) {
  const { rsvp } = invite;
  return (
    <Card className="gap-3 p-4" data-testid="invite-card" data-invite-card="">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={invite.status === "published" ? "default" : "secondary"}>
          {invite.status === "published" ? dashboard.published : dashboard.draft}
        </Badge>
        <Badge variant="outline">{invite.displayMode === "animated" ? "Animated" : "Static"}</Badge>
        <Badge variant="outline">{invite.paid ? dashboard.paid : dashboard.free}</Badge>
        <span className="text-xs text-muted-foreground">{eventTypes[invite.eventType]}</span>
      </div>
      <div>
        <h2 className="font-display text-xl leading-tight font-semibold">{invite.headline}</h2>
        <p className="text-sm text-muted-foreground">{formatWhen(invite.firstEventAt)}</p>
      </div>
      <p className="text-sm">
        {fmt(dashboard.guests, { count: invite.guestCount })}
        {invite.guestCount > 0 && (
          <>
            {" · "}
            {fmt(dashboard.replies, { ...rsvp })}
            {rsvp.yes > 0 && ` · ${fmt(dashboard.attending, { count: rsvp.attending })}`}
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/invites/${invite.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {dashboard.edit}
        </Link>
        <Link href={`/invites/${invite.id}/share`} className={buttonVariants({ size: "sm" })}>
          {dashboard.share}
        </Link>
        <DeleteInviteButton inviteId={invite.id} />
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const invites = await (await getHostRepo()).listInvites(user.id);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">{dashboard.title}</h1>
        <Link href="/invites/new" className={buttonVariants()}>
          {dashboard.create}
        </Link>
      </div>
      {invites.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center" data-testid="empty-state">
          <h2 className="font-display text-2xl font-semibold">{dashboard.emptyTitle}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{dashboard.emptyBody}</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} />
          ))}
        </div>
      )}
    </section>
  );
}
