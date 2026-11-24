"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/copy/en";
import { isE2EFixtureMode } from "@/lib/env";
import { FIXTURE_SESSION_COOKIE } from "@/lib/host/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env.public";

export interface AuthState {
  error?: string;
  notice?: string;
}

const credentials = z.object({
  mode: z.enum(["signin", "signup"]),
  email: z.email().max(254),
  password: z.string().min(8).max(200),
});

export async function authAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    mode: formData.get("mode"),
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: auth.invalidEmailOrPassword };
  const { mode, email, password } = parsed.data;

  if (isE2EFixtureMode()) {
    (await cookies()).set(FIXTURE_SESSION_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();
  if (mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: auth.invalidCredentials };
    redirect("/dashboard");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${publicEnv.siteUrl}/auth/callback` },
  });
  if (error) return { error: auth.invalidEmailOrPassword };
  if (data.session) redirect("/dashboard");
  return { notice: auth.checkEmail };
}

export async function signOutAction(): Promise<void> {
  if (isE2EFixtureMode()) {
    (await cookies()).delete(FIXTURE_SESSION_COOKIE);
  } else {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
