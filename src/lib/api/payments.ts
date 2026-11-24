import { z } from "zod";

import { CURRENCY, PLANS } from "@/config/plans";
import type { HostApiContext } from "@/lib/host/context";
import type { HostRepo } from "@/lib/host/types";
import type { PaymentConfig } from "@/lib/payments/gateway";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payments/signature";

import { errorResponse, jsonResponse, notFound, readJson } from "./http";

/** POST /api/payments/order: server-side order for one invite. The price comes from config only. */
export async function handleCreateOrder(
  request: Request,
  ctx: HostApiContext,
  config: Pick<PaymentConfig, "gateway" | "keyId">,
): Promise<Response> {
  const body = await readJson(request, 1024);
  if (!body.ok) return body.response;
  const parsed = z.object({ inviteId: z.uuid() }).safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");

  const invite = await ctx.repo.getInvite(ctx.user.id, parsed.data.inviteId);
  if (!invite) return notFound();
  if (invite.paid) return errorResponse(409, "conflict", { reason: "already_paid" });

  const amountMinor = PLANS.paid.priceMinor;
  const order = await config.gateway.createOrder({
    amountMinor,
    currency: CURRENCY,
    receipt: `inv_${invite.id.slice(0, 8)}_${Date.now().toString(36)}`,
    notes: { inviteId: invite.id },
  });
  const stored = await ctx.repo.createOrder(ctx.user.id, invite.id, {
    razorpayOrderId: order.id,
    amountMinor,
    currency: CURRENCY,
  });
  if (!stored) return notFound();
  return jsonResponse({ orderId: order.id, amountMinor, currency: CURRENCY, keyId: config.keyId });
}

const verifyBodySchema = z.object({
  razorpayOrderId: z.string().min(1).max(100),
  razorpayPaymentId: z.string().min(1).max(100),
  razorpaySignature: z.string().min(1).max(200),
});

/** POST /api/payments/verify: the browser reports a finished payment; the signature proves it. */
export async function handleVerifyPayment(
  request: Request,
  ctx: HostApiContext,
  config: Pick<PaymentConfig, "keySecret">,
): Promise<Response> {
  const body = await readJson(request, 2048);
  if (!body.ok) return body.response;
  const parsed = verifyBodySchema.safeParse(body.value);
  if (!parsed.success) return errorResponse(400, "invalid_input");
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  const order = await ctx.repo.getOrderByRazorpayId(razorpayOrderId);
  if (!order || order.ownerId !== ctx.user.id) return notFound();

  const valid = verifyCheckoutSignature(
    { orderId: razorpayOrderId, paymentId: razorpayPaymentId, signature: razorpaySignature },
    config.keySecret,
  );
  if (!valid) return errorResponse(400, "invalid_input", { reason: "bad_signature" });

  const result = await ctx.repo.markOrderPaid(razorpayOrderId, razorpayPaymentId);
  return result ? jsonResponse({ paid: true, granted: result.granted }) : notFound();
}

const webhookEventSchema = z.object({
  event: z.string(),
  payload: z
    .object({
      payment: z
        .object({
          entity: z.object({
            id: z.string(),
            order_id: z.string().nullish(),
            amount: z.number().optional(),
            status: z.string().optional(),
          }),
        })
        .optional(),
    })
    .optional(),
});

const GRANTING_EVENTS = new Set(["payment.captured", "order.paid"]);

/**
 * POST /api/payments/webhook. Signature is checked on the RAW body. Idempotent: Razorpay retries
 * and replays are acknowledged with 200 but can never grant twice (see HostRepo.markOrderPaid).
 */
export async function handlePaymentWebhook(
  request: Request,
  repo: HostRepo,
  config: Pick<PaymentConfig, "webhookSecret">,
): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 64 * 1024) return errorResponse(413, "payload_too_large");
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature, config.webhookSecret)) return errorResponse(400, "invalid_input");

  let event: z.infer<typeof webhookEventSchema>;
  try {
    event = webhookEventSchema.parse(JSON.parse(raw));
  } catch {
    return jsonResponse({ ok: true, ignored: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!GRANTING_EVENTS.has(event.event) || !payment?.order_id) return jsonResponse({ ok: true, ignored: true });

  const order = await repo.getOrderByRazorpayId(payment.order_id);
  // Unknown order or an amount that does not match what we charged: acknowledge, never grant.
  if (!order || (payment.amount !== undefined && payment.amount !== order.amountMinor)) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const result = await repo.markOrderPaid(payment.order_id, payment.id);
  return jsonResponse({ ok: true, granted: result?.granted ?? false });
}
