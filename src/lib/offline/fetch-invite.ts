import { type InvitePayload, isInvitePayload } from "../invite-payload";
import { hasAsset, pruneAssets, saveAssetBlob } from "./invite-store";

export type FetchInviteResult =
  | { status: "ok"; payload: InvitePayload; etag: string | null }
  | { status: "not-modified" }
  | { status: "not-found" }
  | { status: "rate-limited" }
  | { status: "error" };

export const inviteApiPath = (token: string) => `/api/invites/by-token/${encodeURIComponent(token)}`;

/**
 * GET /api/invites/by-token/[token]. Pass `revalidate` for silent background
 * refreshes (does not count as a new "open") and the stored ETag to get a 304.
 */
export async function fetchInvitePayload(
  token: string,
  options: { revalidate?: boolean; etag?: string | null; signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<FetchInviteResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const url = `${inviteApiPath(token)}${options.revalidate ? "?revalidate=1" : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.etag) headers["If-None-Match"] = options.etag;

  let response: Response;
  try {
    response = await doFetch(url, { headers, cache: "no-store", credentials: "omit", signal: options.signal });
  } catch {
    return { status: "error" };
  }

  if (response.status === 304) return { status: "not-modified" };
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 429) return { status: "rate-limited" };
  if (!response.ok) return { status: "error" };

  try {
    const payload: unknown = await response.json();
    if (!isInvitePayload(payload)) return { status: "error" };
    return { status: "ok", payload, etag: response.headers.get("ETag") };
  } catch {
    return { status: "error" };
  }
}

/**
 * Copy every asset (hero image, optional audio) into IndexedDB so the invite is
 * fully usable offline. Returns false if any asset could not be saved.
 * `onEssentialDone` fires as soon as the images are saved, without waiting for the (larger) music file.
 */
export async function downloadAssets(
  token: string,
  payload: InvitePayload,
  fetchImpl: typeof fetch = fetch,
  onEssentialDone?: (allSaved: boolean) => void,
): Promise<boolean> {
  const jobs = payload.assets.map((asset) => ({
    kind: asset.kind,
    done: (async () => {
      try {
        if (await hasAsset(token, asset.id)) return true;
        const response = await fetchImpl(asset.url, { credentials: "omit" });
        if (!response.ok) throw new Error(`asset ${response.status}`);
        const blob = await response.blob();
        await saveAssetBlob(token, asset.id, blob.type ? blob : new Blob([blob], { type: asset.contentType }));
        return true;
      } catch {
        return false;
      }
    })(),
  }));
  if (onEssentialDone) {
    void Promise.all(jobs.filter((j) => j.kind !== "audio").map((j) => j.done)).then((oks) => onEssentialDone(oks.every(Boolean)));
  }
  const allSaved = (await Promise.all(jobs.map((j) => j.done))).every(Boolean);
  await pruneAssets(
    token,
    payload.assets.map((a) => a.id),
  ).catch(() => undefined);
  return allSaved;
}
