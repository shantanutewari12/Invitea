import { handleRemoveGuest } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";

export const dynamic = "force-dynamic";

export function DELETE(_request: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  return withHost(params, (ctx, { id, guestId }) => handleRemoveGuest(ctx, id, guestId));
}
