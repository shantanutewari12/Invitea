import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { getHostRepo } from "@/lib/host";
import { requireUser } from "@/lib/host/session";

import { Builder } from "./Builder";

export const metadata: Metadata = { title: "Edit invitation" };

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) notFound();
  const invite = await (await getHostRepo()).getInvite(user.id, id);
  if (!invite) notFound();
  return <Builder invite={invite} isNew={isNew === "1"} />;
}
