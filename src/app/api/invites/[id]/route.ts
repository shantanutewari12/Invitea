import { handleDeleteInvite, handleUpdateInvite } from "@/lib/api/invites";
import { withHost } from "@/lib/host/route";

export const dynamic = "force-dynamic";

export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHost(params, (ctx, { id }) => handleUpdateInvite(request, ctx, id));
}

export function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withHost(params, (ctx, { id }) => handleDeleteInvite(ctx, id));
}
