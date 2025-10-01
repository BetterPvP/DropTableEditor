'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { createBrowserSupabaseClient } from '@/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteCode: z.string().min(4),
});

export function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const validation = schema.safeParse({ email, password, inviteCode });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setLoading(true);

    // Step 1: validate invite
    const validationResponse = await fetch('/api/invite/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode, email }),
    });
    if (!validationResponse.ok) {
      const payload = await validationResponse.json().catch(() => ({}));
      setError(payload.error ?? 'Invite code invalid');
      setLoading(false);
      return;
    }

    // Step 2: sign up
    const supabase = createBrowserSupabaseClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError('Sign up succeeded but no user was returned.');
      setLoading(false);
      return;
    }

    // Step 3: redeem invite
    const redeemRes = await fetch('/api/invite/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: inviteCode, userId: data.user.id }),
    });

    if (!redeemRes.ok) {
      const payload = await redeemRes.json().catch(() => ({}));
      setError(payload.error ?? 'Failed to redeem invite code');
      setLoading(false);
      return; // don’t continue if redeem failed
    }

    // Step 4: ensure the user has an active session. Some projects require email confirmation,
    // which means signUp may not return a session. If that happens, try to sign in directly.
    if (!data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !signInData.session) {
        setError(signInError?.message ?? 'Account created but failed to log you in.');
        setLoading(false);
        return;
      }
    }

    const redirectTo = searchParams.get('redirectTo');
    const safeRedirect = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/';

    setLoading(false);

    router.replace(safeRedirect);
    router.refresh();
  };

  return (
    <Card className="glass-panel">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl text-white">Join BetterPvP</CardTitle>
        <CardDescription>Invites are required. Ask an existing admin for a code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite">Invite code</Label>
            <Input
              id="invite"
              required
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="ADMIN-XXXX"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Validating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-foreground/70">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="text-primary">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
