import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminEnv } from "@/lib/env";

let cached: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so it is used ONLY on the server, for the
 * token API, RSVP upsert, payments and rate limiting, and every query that uses
 * it must be scoped by a verified token or an authenticated owner id.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    const env = getSupabaseAdminEnv();
    cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

export const INVITE_ASSET_BUCKET = "invite-assets";
