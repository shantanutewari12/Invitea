import { createHash, createHmac } from "node:crypto";

import type { InviteRepo } from "@/lib/data/types";

/** Headers for responses that contain personal data: never cached, never indexed. */
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) headers.set(key, value);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export type ApiErrorCode =
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "payload_too_large"
  | "plan_limit"
  | "server_error";

/** Error bodies carry a machine code only, so they never leak details about what exists. */
export function errorResponse(status: number, code: ApiErrorCode, extra?: Record<string, unknown>): Response {
  return jsonResponse({ error: { code, ...extra } }, { status });
}

export const notFound = () => errorResponse(404, "not_found");

/** Best-effort client IP (Vercel and most proxies set x-forwarded-for). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Hash the IP so raw addresses are never stored in the rate-limit table. */
export function hashClient(ip: string): string {
  const pepper = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "regalia-dev-pepper";
  return createHmac("sha256", pepper).update(ip).digest("hex").slice(0, 24);
}

export interface RateLimitConfig {
  windowSeconds: number;
  max: number;
}

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export async function rateLimitByIp(
  repo: InviteRepo,
  scope: string,
  request: Request,
  config: RateLimitConfig,
): Promise<Response | null> {
  const key = `${scope}:${hashClient(clientIp(request))}`;
  const allowed = await repo.consumeRateLimit(key, config.windowSeconds, config.max);
  if (allowed) return null;
  const response = errorResponse(429, "rate_limited");
  response.headers.set("Retry-After", String(config.windowSeconds));
  return response;
}

/** Read a JSON body with a hard size cap. Returns a ready-made error response on failure. */
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const raw = await request.text();
  if (raw.length > maxBytes) return { ok: false, response: errorResponse(413, "payload_too_large") };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, response: errorResponse(400, "invalid_input") };
  }
}

export function etagFor(body: string): string {
  return `"${createHash("sha256").update(body).digest("hex").slice(0, 20)}"`;
}
