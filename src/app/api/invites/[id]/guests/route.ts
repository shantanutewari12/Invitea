import { handleAddGuests } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";

export const dynamic = "force-dynamic";

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHost(params, (ctx, { id }) => handleAddGuests(request, ctx, id));
}
