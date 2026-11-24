import { handleCreateInvite } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withHost(null, (ctx) => handleCreateInvite(request, ctx));
}
