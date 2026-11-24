import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(expectedHex: string, givenHex: string): boolean {
  const expected = Buffer.from(expectedHex, "hex");
  const given = /^[0-9a-f]+$/i.test(givenHex) ? Buffer.from(givenHex, "hex") : Buffer.alloc(0);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** Razorpay Checkout success callback: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(
  args: { orderId: string; paymentId: string; signature: string },
  keySecret: string,
): boolean {
  return safeEqualHex(hmac(keySecret, `${args.orderId}|${args.paymentId}`), args.signature);
}

/** Webhook: HMAC_SHA256(raw request body, webhook_secret). Must be computed on the RAW body. */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  return safeEqualHex(hmac(webhookSecret, rawBody), signature);
}

/** Test helpers: produce valid signatures the same way Razorpay does. */
export const signCheckout = (orderId: string, paymentId: string, keySecret: string) =>
  hmac(keySecret, `${orderId}|${paymentId}`);
export const signWebhook = (rawBody: string, webhookSecret: string) => hmac(webhookSecret, rawBody);
