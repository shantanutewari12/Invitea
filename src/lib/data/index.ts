import "server-only";

import { isE2EFixtureMode } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { createFixtureRepo } from "./fixture-repo";
import { createSupabaseRepo } from "./supabase-repo";
import type { InviteRepo } from "./types";

let cached: InviteRepo | null = null;

export function getInviteRepo(): InviteRepo {
  if (!cached) {
    cached = isE2EFixtureMode() ? createFixtureRepo() : createSupabaseRepo(getSupabaseAdmin());
  }
  return cached;
}

/** Test seam: swap the repo (unit tests). */
export function setInviteRepoForTests(repo: InviteRepo | null): void {
  cached = repo;
}
