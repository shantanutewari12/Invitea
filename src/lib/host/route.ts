import "server-only";

import { z } from "zod";

import { errorResponse, notFound } from "@/lib/api/http";

import { getHostApiContext, type HostApiContext } from "./context";

/** Route wrapper: 401 without a session, 404 for a malformed invite id, 500 never leaks details. */
export async function withHost(
  params: Promise<{ id?: string; guestId?: string }> | null,
  fn: (ctx: HostApiContext, ids: { id: string; guestId: string }) => Promise<Response>,
): Promise<Response> {
  const ctx = await getHostApiContext();
  if (!ctx) return errorResponse(401, "unauthorized");
  const { id = "", guestId = "" } = params ? await params : {};
  if (params && (!z.uuid().safeParse(id).success || (guestId && !z.uuid().safeParse(guestId).success))) {
    return notFound();
  }
  try {
    return await fn(ctx, { id, guestId });
  } catch (error) {
    console.error("host api error", error instanceof Error ? error.message : error);
    return errorResponse(500, "server_error");
  }
}
