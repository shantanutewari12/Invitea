import { NextResponse } from "next/server";

import { getFixtureState, resetFixtureState } from "@/lib/data/fixture-repo";
import { isE2EFixtureMode } from "@/lib/env";

// Test-only window into the in-memory fixture repository so end-to-end tests can assert what
// the "server" received (for example that an offline RSVP arrived exactly once). It answers
// 404 unless the process was started with REGALIA_E2E_FIXTURES=1, and never on Vercel production.
export const dynamic = "force-dynamic";

function enabled(): boolean {
  return isE2EFixtureMode() && process.env.VERCEL_ENV !== "production";
}

function gone() {
  return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
}

export async function GET() {
  if (!enabled()) return gone();
  const state = getFixtureState();
  return NextResponse.json({
    rsvpRequestLog: state.rsvpRequestLog,
    rsvps: Object.fromEntries(state.rsvps),
    opens: Object.fromEntries(state.opens),
  });
}

export async function DELETE() {
  if (!enabled()) return gone();
  resetFixtureState();
  return NextResponse.json({ ok: true });
}
