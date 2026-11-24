import { handleRsvp } from "@/lib/api/rsvp";
import { getInviteRepo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return handleRsvp(request, token, getInviteRepo());
}
