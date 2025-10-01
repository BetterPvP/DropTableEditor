import { SignUpForm } from "./sign-up-form";

export default function SignUpPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Join the team</h1>
        <p className="text-sm text-muted-foreground">Use your invite code to create an administrator account.</p>
      </div>
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        Already invited? <a className="text-primary" href="/auth/sign-in">Sign in</a>.
      </p>
    </div>
  );
}
