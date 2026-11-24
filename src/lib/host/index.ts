import "server-only";

import { isE2EFixtureMode } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createFixtureHostRepo } from "./fixture-host-repo";
import { createSupabaseHostRepo } from "./supabase-host-repo";
import type { HostRepo } from "./types";

let override: HostRepo | null = null;
let fixtureRepo: HostRepo | null = null;

/** Host data access for the signed-in user: reads run through RLS. */
export async function getHostRepo(): Promise<HostRepo> {
  if (override) return override;
  if (isE2EFixtureMode()) return (fixtureRepo ??= createFixtureHostRepo());
  return createSupabaseHostRepo({ admin: getSupabaseAdmin(), reader: await createSupabaseServerClient() });
}

/** For signature-verified webhooks, which have no signed-in user. */
export function getServiceHostRepo(): HostRepo {
  if (override) return override;
  if (isE2EFixtureMode()) return (fixtureRepo ??= createFixtureHostRepo());
  const admin = getSupabaseAdmin();
  return createSupabaseHostRepo({ admin, reader: admin });
}

/** Test seam. */
export function setHostRepoForTests(repo: HostRepo | null): void {
  override = repo;
}
