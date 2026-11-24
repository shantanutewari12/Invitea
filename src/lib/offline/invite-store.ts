import type { InvitePayload } from "../invite-payload";
import { isInvitePayload } from "../invite-payload";
import { openRegaliaDb, type StoredInvite } from "./db";

export async function loadStoredInvite(token: string): Promise<StoredInvite | null> {
  try {
    const db = await openRegaliaDb();
    const stored = await db.get("invites", token);
    // Refuse anything that is not a well-formed payload (corruption, old schema).
    if (!stored || !isInvitePayload(stored.payload)) return null;
    return stored;
  } catch {
    return null;
  }
}

export async function saveInvite(
  token: string,
  payload: InvitePayload,
  etag: string | null,
  now = Date.now(),
): Promise<StoredInvite> {
  const db = await openRegaliaDb();
  const previous = await db.get("invites", token);
  const stored: StoredInvite = {
    token,
    payload,
    etag,
    savedAt: previous?.savedAt ?? now,
    checkedAt: now,
  };
  await db.put("invites", stored);
  return stored;
}

/** Record a successful "nothing changed" revalidation. */
export async function touchInvite(token: string, now = Date.now()): Promise<void> {
  const db = await openRegaliaDb();
  const stored = await db.get("invites", token);
  if (stored) await db.put("invites", { ...stored, checkedAt: now });
}

/** Remember the guest's own reply locally so it shows immediately, even before it is synced. */
export async function updateStoredRsvp(
  token: string,
  rsvp: { status: "yes" | "no" | "maybe"; partySize: number; message: string },
): Promise<void> {
  const db = await openRegaliaDb();
  const stored = await db.get("invites", token);
  if (!stored || stored.payload.audience.kind !== "guest") return;
  await db.put("invites", {
    ...stored,
    payload: { ...stored.payload, audience: { ...stored.payload.audience, rsvp } },
  });
}

export async function deleteInvite(token: string): Promise<void> {
  const db = await openRegaliaDb();
  const tx = db.transaction(["invites", "assets"], "readwrite");
  await tx.objectStore("invites").delete(token);
  const assets = tx.objectStore("assets");
  for (const key of await assets.index("by-token").getAllKeys(token)) await assets.delete(key);
  await tx.done;
}

export const assetKey = (token: string, assetId: string) => `${token}:${assetId}`;

export async function saveAssetBlob(token: string, assetId: string, blob: Blob): Promise<void> {
  const db = await openRegaliaDb();
  await db.put("assets", {
    key: assetKey(token, assetId),
    token,
    assetId,
    blob,
    contentType: blob.type,
  });
}

export async function hasAsset(token: string, assetId: string): Promise<boolean> {
  const db = await openRegaliaDb();
  return (await db.getKey("assets", assetKey(token, assetId))) !== undefined;
}

export async function loadAssetBlob(token: string, assetId: string): Promise<Blob | null> {
  try {
    const db = await openRegaliaDb();
    const stored = await db.get("assets", assetKey(token, assetId));
    return stored?.blob ?? null;
  } catch {
    return null;
  }
}

/** Drop assets that the latest payload no longer references. */
export async function pruneAssets(token: string, keepAssetIds: string[]): Promise<void> {
  const db = await openRegaliaDb();
  const keep = new Set(keepAssetIds.map((id) => assetKey(token, id)));
  const tx = db.transaction("assets", "readwrite");
  for (const key of await tx.store.index("by-token").getAllKeys(token)) {
    if (!keep.has(key)) await tx.store.delete(key);
  }
  await tx.done;
}
