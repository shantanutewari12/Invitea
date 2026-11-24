import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { formatPriceInr, PLANS } from "@/config/plans";
import { publicEnv } from "@/lib/env.public";
import { getHostRepo } from "@/lib/host";
import { requireUser } from "@/lib/host/session";

import { SharePanel } from "./SharePanel";

export const metadata: Metadata = { title: "Share & guests" };

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const repo = await getHostRepo();
  const [invite, guests] = await Promise.all([repo.getInvite(user.id, id), repo.listGuests(user.id, id)]);
  if (!invite || !guests) notFound();

  return (
    <SharePanel
      invite={invite}
      initialGuests={guests}
      siteUrl={publicEnv.siteUrl}
      guestCap={invite.paid ? PLANS.paid.guestCap : PLANS.free.guestCap}
      price={{ minor: PLANS.paid.priceMinor, label: formatPriceInr(PLANS.paid.priceMinor) }}
      email={user.email}
    />
  );
}
