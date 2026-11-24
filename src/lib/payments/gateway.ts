import "server-only";
import { randomUUID } from "node:crypto";

import Razorpay from "razorpay";

import { getRazorpayEnv, getRazorpayWebhookEnv, isE2EFixtureMode } from "@/lib/env";

export interface PaymentGateway {
  createOrder(args: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
}

export interface PaymentConfig {
  gateway: PaymentGateway;
  /** Public key id handed to Checkout. */
  keyId: string;
  /** Secret used to verify the Checkout success signature. */
  keySecret: string;
  webhookSecret: string;
}

export const FIXTURE_PAYMENT_SECRETS = { keyId: "rzp_test_fixture", keySecret: "fixture_key_secret", webhookSecret: "fixture_webhook_secret" } as const;

let override: PaymentConfig | null = null;

export function getPaymentConfig(): PaymentConfig {
  if (override) return override;
  if (isE2EFixtureMode()) {
    return {
      gateway: { createOrder: async () => ({ id: `order_fx_${randomUUID().replaceAll("-", "").slice(0, 14)}` }) },
      ...FIXTURE_PAYMENT_SECRETS,
    };
  }
  const env = getRazorpayEnv();
  const client = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  return {
    gateway: {
      createOrder: async ({ amountMinor, currency, receipt, notes }) =>
        client.orders.create({ amount: amountMinor, currency, receipt, notes }),
    },
    keyId: env.RAZORPAY_KEY_ID,
    keySecret: env.RAZORPAY_KEY_SECRET,
    webhookSecret: getRazorpayWebhookEnv().RAZORPAY_WEBHOOK_SECRET,
  };
}

/** Test seam. */
export function setPaymentConfigForTests(config: PaymentConfig | null): void {
  override = config;
}
