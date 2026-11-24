import "server-only";

import { getInviteRepo } from "@/lib/data";
import type { InviteRepo } from "@/lib/data/types";

import { getHostRepo } from "./index";
import { getSessionUser } from "./session";
import type { HostRepo, HostUser } from "./types";

/** What every authenticated host API handler receives. Built per request by the route file. */
export interface HostApiContext {
  user: HostUser;
  repo: HostRepo;
  limiter: Pick<InviteRepo, "consumeRateLimit">;
}

export async function getHostApiContext(): Promise<HostApiContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user, repo: await getHostRepo(), limiter: getInviteRepo() };
}
