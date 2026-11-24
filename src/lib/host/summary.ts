import type { InviteSpec } from "@/lib/spec/schema";

import type { RsvpCounts } from "./types";

/** Start of the earliest event, for sorting and display on the dashboard. */
export function earliestStart(spec: InviteSpec): string | null {
  let best: number | null = null;
  for (const event of spec.events) {
    const time = Date.parse(event.startsAt);
    if (!Number.isNaN(time) && (best === null || time < best)) best = time;
  }
  return best === null ? null : new Date(best).toISOString();
}

export const emptyCounts = (): RsvpCounts => ({ yes: 0, no: 0, maybe: 0, pending: 0, attending: 0 });

/** Fold one guest's reply (or lack of one) into the running counts. */
export function addReply(
  counts: RsvpCounts,
  reply: { status: "yes" | "no" | "maybe"; partySize: number } | null,
): void {
  if (!reply) {
    counts.pending += 1;
    return;
  }
  counts[reply.status] += 1;
  if (reply.status === "yes") counts.attending += reply.partySize;
}
