import { handleTokenLookup } from "@/lib/api/by-token";
import { getInviteRepo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleTokenLookup(request, token, getInviteRepo());
}
