import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env.public";
import { resizeToWebp } from "@/lib/image-resize";

export interface UploadedAsset {
  id: string;
  kind: "image" | "audio";
  contentType: string;
}

/** Sign -> upload straight to storage -> confirm. Images are resized to <=1600px WebP first. */
export async function uploadAsset(inviteId: string, kind: "image" | "audio", file: File): Promise<UploadedAsset> {
  const body: Blob = kind === "image" ? await resizeToWebp(file) : file;
  const contentType = kind === "image" ? "image/webp" : file.type;

  const signed = await fetch(`/api/invites/${inviteId}/assets/sign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, contentType, bytes: body.size }),
  });
  if (!signed.ok) throw new Error(signed.status === 413 ? "too_large" : signed.status === 400 ? "type" : "failed");
  const { assetId, target } = (await signed.json()) as {
    assetId: string;
    target:
      | { strategy: "supabase"; bucket: string; path: string; token: string }
      | { strategy: "direct"; url: string };
  };

  if (target.strategy === "direct") {
    const put = await fetch(target.url, { method: "PUT", headers: { "content-type": contentType }, body });
    if (!put.ok) throw new Error("failed");
  } else {
    const storage = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey).storage.from(target.bucket);
    const { error } = await storage.uploadToSignedUrl(target.path, target.token, body, { contentType });
    if (error) throw new Error("failed");
  }

  const confirmed = await fetch(`/api/invites/${inviteId}/assets/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId, kind, contentType }),
  });
  if (!confirmed.ok) throw new Error("failed");
  return { id: assetId, kind, contentType };
}
