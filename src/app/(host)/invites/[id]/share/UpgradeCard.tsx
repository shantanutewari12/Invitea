"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmt, share } from "@/copy/en";
import { track } from "@/lib/analytics";

interface CheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, cb: () => void): void };
  }
}

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function postJson(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

/** Free-plan upsell. Order creation and verification are server-side; the browser only opens Checkout. */
export function UpgradeCard({
  inviteId,
  price,
  email,
  onPaid,
}: {
  inviteId: string;
  price: { minor: number; label: string };
  email: string;
  onPaid: () => void;
}) {
  const [state, setState] = useState<"idle" | "working" | "confirming" | "failed">("idle");

  async function pay() {
    setState("working");
    try {
      const orderResponse = await postJson("/api/payments/order", { inviteId });
      if (!orderResponse.ok || !(await loadCheckout()) || !window.Razorpay) throw new Error("order");
      const order = (await orderResponse.json()) as { orderId: string; amountMinor: number; currency: string; keyId: string };

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountMinor,
        currency: order.currency,
        name: "Regalia",
        prefill: { email },
        theme: { color: "#6b1d2a" },
        handler: async (response: CheckoutResponse) => {
          setState("confirming");
          const verified = await postJson("/api/payments/verify", {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          if (verified.ok) {
            track("payment_succeeded", { plan: "paid" });
            setState("idle");
            onPaid();
          } else {
            setState("failed");
          }
        },
        modal: { ondismiss: () => setState("idle") },
      });
      checkout.on("payment.failed", () => setState("failed"));
      track("checkout_started", { plan: "paid" });
      checkout.open();
    } catch {
      setState("failed");
    }
  }

  return (
    <Card className="gap-3 border-gold p-4" data-testid="upgrade-card">
      <h2 className="font-display text-xl font-semibold">{share.upgradeTitle}</h2>
      <p className="text-sm text-muted-foreground">{share.upgradeBody}</p>
      <Button type="button" className="self-start" disabled={state === "working" || state === "confirming"} onClick={() => void pay()} data-amount={price.minor}>
        {state === "confirming" ? share.paymentPending : fmt(share.upgrade, { price: price.label })}
      </Button>
      {state === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {share.paymentFailed}
        </p>
      )}
    </Card>
  );
}
