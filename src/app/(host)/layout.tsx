import Link from "next/link";

import { Button } from "@/components/ui/button";
import { brand, common } from "@/copy/en";
import { requireUser } from "@/lib/host/session";

import { signOutAction } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/dashboard" className="font-display text-2xl font-semibold text-primary">
          {brand.name}
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline" data-testid="user-email">
            {user.email}
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              {common.signOut}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
