import { errorResponse } from "@/lib/api/http";
import { handlePaymentWebhook } from "@/lib/api/payments";
import { getServiceHostRepo } from "@/lib/host";
import { getPaymentConfig } from "@/lib/payments/gateway";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    return await handlePaymentWebhook(request, getServiceHostRepo(), getPaymentConfig());
  } catch (error) {
    console.error("payment webhook error", error instanceof Error ? error.message : error);
    // 5xx makes Razorpay retry later, which is what we want for transient failures.
    return errorResponse(500, "server_error");
  }
}
