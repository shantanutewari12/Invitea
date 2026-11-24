import { z } from "zod";

import { notFound } from "@/lib/api/http";
import { handleGetOwnAsset } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";
import { getAssetStorage } from "@/lib/host/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assetId: string }> }) {
  const { assetId } = await params;
  if (!z.uuid().safeParse(assetId).success) return notFound();
  return withHost(params, (ctx, { id }) => handleGetOwnAsset(ctx, getAssetStorage(), id, assetId));
}
