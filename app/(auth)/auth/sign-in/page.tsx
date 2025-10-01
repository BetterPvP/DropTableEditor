import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in with your BetterPvP admin credentials.</p>
      </div>
      <SignInForm />
      <p className="text-sm text-muted-foreground">
        Need an account? <a className="text-primary" href="/auth/sign-up">Use an invite code</a>.
      </p>
    </div>
  );
}
