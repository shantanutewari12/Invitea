"use client";

import { useEffect, useState } from "react";

import type { InvitePayload } from "@/lib/invite-payload";
import { loadAssetBlob } from "@/lib/offline/invite-store";
import type { RendererAssets } from "@/renderer/types";

/**
 * Resolve hero image / music to object URLs from IndexedDB (works offline). On the very
 * first online load, before the copy is saved, fall back to the token-scoped network URL.
 */
export function useAssetUrls(token: string, payload: InvitePayload, assetsVersion: number): RendererAssets {
  const [urls, setUrls] = useState<RendererAssets>({});

  useEffect(() => {
    let cancelled = false;
    const created: string[] = [];

    (async () => {
      const next: RendererAssets = {};
      const { image, music } = payload.invite.spec;
      for (const asset of payload.assets) {
        const blob = await loadAssetBlob(token, asset.id);
        let url: string | null = null;
        if (blob) {
          url = URL.createObjectURL(blob);
          created.push(url);
        } else if (navigator.onLine) {
          url = asset.url;
        }
        if (asset.kind === "image" && image?.assetId === asset.id) next.imageUrl = url;
        if (asset.kind === "audio" && music?.assetId === asset.id) next.audioUrl = url;
      }
      if (cancelled) {
        created.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      setUrls(next);
    })().catch(() => undefined);

    return () => {
      cancelled = true;
      // Revoke later so an image that is currently on screen does not blink out.
      setTimeout(() => created.forEach((u) => URL.revokeObjectURL(u)), 1000);
    };
  }, [token, payload, assetsVersion]);

  return urls;
}
