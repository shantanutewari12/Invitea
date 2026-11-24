/** Time zone helpers. No dependencies; relies on Intl, which every target browser has. */

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Offset (in minutes, east of UTC positive) of `timeZone` at the instant `date`. */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

function formatOffset(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(totalMinutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Convert a wall-clock time typed by the host ("2026-12-05T18:30" from a
 * datetime-local input) in `timeZone` into an ISO-8601 string with offset.
 * Returns null for malformed input.
 */
export function localDateTimeToIso(local: string, timeZone: string): string | null {
  const match = LOCAL_RE.exec(local);
  if (!match || !isValidTimeZone(timeZone)) return null;
  const [, y, mo, d, h, mi, s] = match;
  const wallAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  if (Number.isNaN(wallAsUtc)) return null;
  // Date.UTC silently rolls impossible values over (month 13, Feb 30, 25:61). Reject them
  // by checking that the fields survive a round trip.
  const check = new Date(wallAsUtc);
  if (
    check.getUTCFullYear() !== Number(y) ||
    check.getUTCMonth() !== Number(mo) - 1 ||
    check.getUTCDate() !== Number(d) ||
    check.getUTCHours() !== Number(h) ||
    check.getUTCMinutes() !== Number(mi) ||
    check.getUTCSeconds() !== Number(s ?? 0)
  ) {
    return null;
  }

  // Two passes handle zones whose offset changes (DST) near the requested time.
  let offset = zoneOffsetMinutes(new Date(wallAsUtc), timeZone);
  offset = zoneOffsetMinutes(new Date(wallAsUtc - offset * 60000), timeZone);

  return `${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}${formatOffset(offset)}`;
}

/** Human readable date and time in the event's own time zone. */
export function formatEventWhen(
  startsAt: string,
  timeZone: string,
  locale = "en-IN",
): { date: string; time: string; zone: string } {
  const instant = new Date(startsAt);
  const zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  if (Number.isNaN(instant.getTime())) return { date: "", time: "", zone };
  const date = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(instant);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
  return { date, time, zone };
}

/** Inverse of localDateTimeToIso: the wall-clock value ("YYYY-MM-DDTHH:mm") for a datetime-local input. */
export function isoToLocalInput(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
