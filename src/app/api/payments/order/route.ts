import { handleCreateOrder } from "@/lib/api/payments";
import { withHost } from "@/lib/host/route";
import { getPaymentConfig } from "@/lib/payments/gateway";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return withHost(null, (ctx) => handleCreateOrder(request, ctx, getPaymentConfig()));
}
