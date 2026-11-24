"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { dashboard } from "@/copy/en";

/**
 * Deletes an invitation (and its guests, replies and files). No browser dialog: the button turns
 * into an inline "Delete for good?" choice, then a toast confirms it.
 */
export function DeleteInviteButton({ inviteId, redirectTo }: { inviteId: string; redirectTo?: string }) {
  const router = useRouter();
  const toast = useToast();
  const root = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");

  // An unanswered question quietly goes back to a plain Delete button.
  useEffect(() => {
    if (step !== "confirm") return;
    const id = window.setTimeout(() => setStep("idle"), 6000);
    return () => window.clearTimeout(id);
  }, [step]);

  async function remove() {
    setStep("busy");
    try {
      const response = await fetch(`/api/invites/${inviteId}`, { method: "DELETE" });
      if (!response.ok) throw new Error(String(response.status));
    } catch {
      setStep("idle");
      toast.show(dashboard.deleteFailed, "error");
      return;
    }
    root.current?.closest("[data-invite-card]")?.classList.add("invite-card-leaving");
    toast.show(dashboard.deleted);
    if (redirectTo) router.push(redirectTo);
    // Let the card finish fading out before the list re-renders without it.
    window.setTimeout(() => router.refresh(), redirectTo ? 0 : 320);
  }

  return (
    <span ref={root} className="inline-flex flex-wrap items-center gap-1">
      {step === "confirm" ? (
        <>
          <span className="text-sm font-semibold text-destructive">{dashboard.deleteSure}</span>
          <Button type="button" size="sm" variant="destructive" onClick={() => void remove()}>
            {dashboard.deleteYes}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setStep("idle")}>
            {dashboard.deleteKeep}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={step === "busy"}
          onClick={() => setStep("confirm")}
        >
          {step === "busy" ? dashboard.deleting : dashboard.delete}
        </Button>
      )}
    </span>
  );
}
