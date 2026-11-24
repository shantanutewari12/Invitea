"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { dashboard } from "@/copy/en";

/** Deletes an invitation (and its guests, replies and files) after a confirmation. */
export function DeleteInviteButton({ inviteId, redirectTo }: { inviteId: string; redirectTo?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function remove() {
    if (!window.confirm(dashboard.deleteConfirm)) return;
    setBusy(true);
    setFailed(false);
    const response = await fetch(`/api/invites/${inviteId}`, { method: "DELETE" });
    if (!response.ok) {
      setBusy(false);
      setFailed(true);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void remove()}>
        {busy ? dashboard.deleting : dashboard.delete}
      </Button>
      {failed && (
        <span role="alert" className="text-sm text-destructive">
          {dashboard.deleteFailed}
        </span>
      )}
    </>
  );
}
