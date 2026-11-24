import { handleAssetFetch } from "@/lib/api/asset";
import { getInviteRepo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; assetId: string }> },
) {
  const { token, assetId } = await params;
  return handleAssetFetch(request, token, assetId, getInviteRepo());
}
