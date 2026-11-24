import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { FIXTURE_USER } from "@/lib/data/fixtures";
import { isE2EFixtureMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { HostUser } from "./types";

export const FIXTURE_SESSION_COOKIE = "regalia_fixture_session";

/** The signed-in host, or null. Supabase verifies the JWT with the auth server (getUser). */
export async function getSessionUser(): Promise<HostUser | null> {
  if (isE2EFixtureMode()) {
    const signedIn = (await cookies()).get(FIXTURE_SESSION_COOKIE)?.value === "1";
    return signedIn ? { id: FIXTURE_USER.id, email: FIXTURE_USER.email } : null;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null;
}

export async function requireUser(): Promise<HostUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
