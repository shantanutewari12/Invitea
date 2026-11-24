import { handleGenerateInvite } from "@/lib/api/ai";
import { getLlmProvider } from "@/lib/ai";
import { withHost } from "@/lib/host/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(request: Request) {
  return withHost(null, (ctx) => handleGenerateInvite(request, ctx, getLlmProvider()));
}
