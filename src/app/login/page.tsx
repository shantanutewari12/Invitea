import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, brand } from "@/copy/en";
import { isE2EFixtureMode } from "@/lib/env";
import { getSessionUser } from "@/lib/host/session";

import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5 py-10">
      <header className="text-center">
        <p className="font-display text-4xl font-semibold text-primary">{brand.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{brand.tagline}</p>
        <h1 className="mt-8 font-display text-2xl font-semibold">{auth.signInTitle}</h1>
      </header>
      <AuthForm demo={isE2EFixtureMode()} />
    </main>
  );
}
