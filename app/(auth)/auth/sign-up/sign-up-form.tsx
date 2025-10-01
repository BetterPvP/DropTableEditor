"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signUpAction, type SignUpResult } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState: SignUpResult = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating account..." : "Create account"}
    </Button>
  );
}

export function SignUpForm() {
  const [state, formAction] = useFormState(signUpAction, initialState);

  return (
    <form className="space-y-5" action={formAction}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite">Invite code</Label>
        <Input id="invite" name="invite" type="text" inputMode="text" autoComplete="one-time-code" required placeholder="INVITE-XXXX" />
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
