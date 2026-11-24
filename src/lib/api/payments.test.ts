import { beforeEach, describe, expect, it } from "vitest";

import { PLANS } from "@/config/plans";
import { createFixtureRepo, getFixtureState, resetFixtureState } from "@/lib/data/fixture-repo";
import { FIXTURE_IDS, FIXTURE_USER } from "@/lib/data/fixtures";
import { createFixtureHostRepo } from "@/lib/host/fixture-host-repo";
import type { HostApiContext } from "@/lib/host/context";
import type { HostRepo } from "@/lib/host/types";
import { signCheckout, signWebhook } from "@/lib/payments/signature";

import { handleCreateOrder, handlePaymentWebhook, handleVerifyPayment } from "./payments";

const SECRETS = { keyId: "rzp_test_key", keySecret: "key_secret", webhookSecret: "webhook_secret" };
const INVITE = FIXTURE_IDS.staticInvite; // free plan in the fixtures
const OTHER_USER = { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", email: "other@regalia.test" };

let repo: HostRepo;
let orderCounter: number;
const gateway = { createOrder: async () => ({ id: `order_${++orderCounter}` }) };

const ctxFor = (user: { id: string; email: string }): HostApiContext => ({ user, repo, limiter: createFixtureRepo() });
const owner = () => ctxFor({ id: FIXTURE_USER.id, email: FIXTURE_USER.email });
const json = (body: unknown) =>
  new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

async function placeOrder(): Promise<string> {
  const res = await handleCreateOrder(json({ inviteId: INVITE }), owner(), { gateway, keyId: SECRETS.keyId });
  expect(res.status).toBe(200);
  return (await res.json()).orderId as string;
}

const webhookRequest = (event: unknown, secret = SECRETS.webhookSecret) => {
  const raw = JSON.stringify(event);
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    body: raw,
    headers: { "x-razorpay-signature": signWebhook(raw, secret) },
  });
};
const captured = (orderId: string, paymentId: string, amount = PLANS.paid.priceMinor) => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, amount, status: "captured" } } },
});

const paidOrders = () => getFixtureState().orders.filter((o) => o.status === "paid");
const inviteIsPaid = async () => (await repo.getInvite(FIXTURE_USER.id, INVITE))!.paid;

beforeEach(() => {
  resetFixtureState();
  repo = createFixtureHostRepo();
  orderCounter = 0;
});

describe("POST /api/payments/order", () => {
  it("creates a server-side order priced from config, never from the client", async () => {
    const res = await handleCreateOrder(json({ inviteId: INVITE, amountMinor: 1 }), owner(), { gateway, keyId: SECRETS.keyId });
    const body = await res.json();
    expect(body).toMatchObject({ orderId: "order_1", amountMinor: PLANS.paid.priceMinor, currency: "INR", keyId: SECRETS.keyId });
    expect(getFixtureState().orders).toHaveLength(1);
  });

  it("does not let a host pay for someone else's invite", async () => {
    const res = await handleCreateOrder(json({ inviteId: INVITE }), ctxFor(OTHER_USER), { gateway, keyId: SECRETS.keyId });
    expect(res.status).toBe(404);
    expect(getFixtureState().orders).toHaveLength(0);
  });

  it("refuses a new order for an invite that is already paid", async () => {
    const res = await handleCreateOrder(json({ inviteId: FIXTURE_IDS.animatedInvite }), owner(), { gateway, keyId: SECRETS.keyId });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/payments/verify", () => {
  it("grants on a valid signature", async () => {
    const orderId = await placeOrder();
    const res = await handleVerifyPayment(
      json({ razorpayOrderId: orderId, razorpayPaymentId: "pay_1", razorpaySignature: signCheckout(orderId, "pay_1", SECRETS.keySecret) }),
      owner(),
      SECRETS,
    );
    expect(await res.json()).toEqual({ paid: true, granted: true });
    expect(await inviteIsPaid()).toBe(true);
  });

  it("rejects a forged signature and grants nothing", async () => {
    const orderId = await placeOrder();
    const res = await handleVerifyPayment(
      json({ razorpayOrderId: orderId, razorpayPaymentId: "pay_1", razorpaySignature: signCheckout(orderId, "pay_1", "wrong_secret") }),
      owner(),
      SECRETS,
    );
    expect(res.status).toBe(400);
    expect(await inviteIsPaid()).toBe(false);
  });

  it("does not let another host verify an order that is not theirs", async () => {
    const orderId = await placeOrder();
    const res = await handleVerifyPayment(
      json({ razorpayOrderId: orderId, razorpayPaymentId: "pay_1", razorpaySignature: signCheckout(orderId, "pay_1", SECRETS.keySecret) }),
      ctxFor(OTHER_USER),
      SECRETS,
    );
    expect(res.status).toBe(404);
    expect(await inviteIsPaid()).toBe(false);
  });
});

describe("POST /api/payments/webhook", () => {
  it("grants once and a replayed webhook does not double-grant (acceptance #6)", async () => {
    const orderId = await placeOrder();
    const results = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await handlePaymentWebhook(webhookRequest(captured(orderId, "pay_1")), repo, SECRETS);
      expect(res.status).toBe(200);
      results.push((await res.json()).granted);
    }
    expect(results).toEqual([true, false, false, false, false]);
    expect(paidOrders()).toHaveLength(1);
    expect(paidOrders()[0].razorpayPaymentId).toBe("pay_1");
    expect(await inviteIsPaid()).toBe(true);
  });

  it("grants exactly once when the browser verify and the webhook race", async () => {
    const orderId = await placeOrder();
    const verify = handleVerifyPayment(
      json({ razorpayOrderId: orderId, razorpayPaymentId: "pay_9", razorpaySignature: signCheckout(orderId, "pay_9", SECRETS.keySecret) }),
      owner(),
      SECRETS,
    );
    const hook = handlePaymentWebhook(webhookRequest(captured(orderId, "pay_9")), repo, SECRETS);
    const [a, b] = await Promise.all([verify, hook]);
    const granted = [(await a.json()).granted, (await b.json()).granted];
    expect(granted.filter(Boolean)).toHaveLength(1);
    expect(paidOrders()).toHaveLength(1);
  });

  it("one payment id can never be attached to a second order", async () => {
    const first = await placeOrder();
    const second = await placeOrder();
    await handlePaymentWebhook(webhookRequest(captured(first, "pay_same")), repo, SECRETS);
    const res = await handlePaymentWebhook(webhookRequest(captured(second, "pay_same")), repo, SECRETS);
    expect((await res.json()).granted).toBe(false);
    expect(paidOrders()).toHaveLength(1);
  });

  it("rejects a bad or missing signature", async () => {
    const orderId = await placeOrder();
    const forged = await handlePaymentWebhook(webhookRequest(captured(orderId, "pay_1"), "attacker_secret"), repo, SECRETS);
    expect(forged.status).toBe(400);
    const unsigned = await handlePaymentWebhook(new Request("http://x", { method: "POST", body: JSON.stringify(captured(orderId, "pay_1")) }), repo, SECRETS);
    expect(unsigned.status).toBe(400);
    expect(paidOrders()).toHaveLength(0);
  });

  it("acknowledges but never grants for a mismatched amount, an unknown order or other events", async () => {
    const orderId = await placeOrder();
    for (const event of [
      captured(orderId, "pay_1", 100),
      captured("order_unknown", "pay_2"),
      { event: "payment.failed", payload: { payment: { entity: { id: "pay_3", order_id: orderId } } } },
      { event: "refund.created" },
    ]) {
      const res = await handlePaymentWebhook(webhookRequest(event), repo, SECRETS);
      expect(res.status).toBe(200);
    }
    expect(paidOrders()).toHaveLength(0);
    expect(await inviteIsPaid()).toBe(false);
  });
});
