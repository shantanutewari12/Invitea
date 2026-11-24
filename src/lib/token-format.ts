/**
 * Token and slug shape checks. No imports: shared by the guest viewer (browser),
 * route handlers and tests.
 *
 * Guest and common-link tokens are nanoid strings (URL-safe alphabet, 21 chars,
 * about 126 bits of entropy). Paid invites may also expose a custom slug.
 */

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,39}$/;

export function isGuestToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function isSlug(value: unknown): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

/** True when the last URL segment could be a token or a slug (the server decides which). */
export function isPlausibleInviteKey(value: unknown): value is string {
  return isGuestToken(value) || isSlug(value);
}

/** Extract the invite key from a /i/<key> pathname, or null. */
export function inviteKeyFromPathname(pathname: string): string | null {
  const match = /^\/i\/([^/?#]+)\/?$/.exec(pathname);
  if (!match) return null;
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isPlausibleInviteKey(key) ? key : null;
}
