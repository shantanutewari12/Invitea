"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, common } from "@/copy/en";

import { authAction, type AuthState } from "./actions";

export function AuthForm({ demo }: { demo: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState<AuthState, FormData>(authAction, {});

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">{auth.email}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{auth.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
          className="h-11"
        />
        {mode === "signup" && <p className="text-xs text-muted-foreground">{auth.passwordHint}</p>}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm text-primary">
          {state.notice}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? common.loading : mode === "signin" ? auth.signIn : auth.signUp}
      </Button>
      <Button type="button" variant="link" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? auth.toSignUp : auth.toSignIn}
      </Button>
      {demo && <p className="text-center text-xs text-muted-foreground">{auth.demoNote}</p>}
    </form>
  );
}
