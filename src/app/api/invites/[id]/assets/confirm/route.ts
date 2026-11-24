import { handleConfirmUpload } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";
import { getAssetStorage } from "@/lib/host/storage";

export const dynamic = "force-dynamic";

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHost(params, (ctx, { id }) => handleConfirmUpload(request, ctx, getAssetStorage(), id));
}
