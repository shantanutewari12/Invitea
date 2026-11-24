import "server-only";

import { getFixtureState } from "@/lib/data/fixture-repo";
import type { AssetContent } from "@/lib/data/types";
import { isE2EFixtureMode } from "@/lib/env";
import { getSupabaseAdmin, INVITE_ASSET_BUCKET } from "@/lib/supabase/admin";

export type UploadTarget =
  | { strategy: "supabase"; bucket: string; path: string; token: string }
  /** Fixture mode only: the browser PUTs the bytes to this same-origin URL. */
  | { strategy: "direct"; url: string };

/** Private object storage for invitation assets. Browsers upload via signed URLs only. */
export interface AssetStorage {
  createUpload(path: string): Promise<UploadTarget>;
  stat(path: string): Promise<{ bytes: number; contentType: string } | null>;
  remove(path: string): Promise<void>;
  download(path: string): Promise<AssetContent | null>;
}

const assetIdOf = (path: string) => path.split("/").pop()?.split(".")[0] ?? "";

function createFixtureStorage(): AssetStorage {
  const blobs = (): Map<string, AssetContent> => getFixtureState().assetBlobs;
  return {
    async createUpload(path) {
      return { strategy: "direct", url: `/api/e2e/upload/${assetIdOf(path)}` };
    },
    async stat(path) {
      const blob = blobs().get(assetIdOf(path));
      return blob ? { bytes: blob.bytes.byteLength, contentType: blob.contentType } : null;
    },
    async remove(path) {
      blobs().delete(assetIdOf(path));
    },
    async download(path) {
      return blobs().get(assetIdOf(path)) ?? null;
    },
  };
}

function createSupabaseStorage(): AssetStorage {
  const bucket = () => getSupabaseAdmin().storage.from(INVITE_ASSET_BUCKET);
  return {
    async createUpload(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw new Error(`signed upload: ${error?.message ?? "no data"}`);
      return { strategy: "supabase", bucket: INVITE_ASSET_BUCKET, path: data.path, token: data.token };
    },
    async stat(path) {
      const slash = path.lastIndexOf("/");
      const { data } = await bucket().list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
      const item = data?.find((entry) => entry.name === path.slice(slash + 1));
      const meta = item?.metadata as { size?: number; mimetype?: string } | null | undefined;
      return meta?.size ? { bytes: meta.size, contentType: meta.mimetype ?? "application/octet-stream" } : null;
    },
    async remove(path) {
      await bucket().remove([path]);
    },
    async download(path) {
      const { data, error } = await bucket().download(path);
      if (error || !data) return null;
      return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: data.type };
    },
  };
}

let override: AssetStorage | null = null;

export function getAssetStorage(): AssetStorage {
  return override ?? (isE2EFixtureMode() ? createFixtureStorage() : createSupabaseStorage());
}

/** Test seam. */
export function setAssetStorageForTests(storage: AssetStorage | null): void {
  override = storage;
}
