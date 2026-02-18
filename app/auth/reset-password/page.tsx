'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/supabase/client';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const exchange = async () => {
      await supabase.auth.exchangeCodeForSession(window.location.href);
      setReady(true);
    };

    exchange();
  }, []);

  if (!ready) return null;

  return <ResetPasswordForm />;
}
