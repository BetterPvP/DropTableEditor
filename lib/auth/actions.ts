'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import {
  getUserByEmail, createUser, peekInvite, consumeInvite,
} from '@/lib/db/repositories/users';

const LANDING = '/loot-tables';

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/auth/sign-in' });
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return 'Enter a valid email and password.';

  try {
    await signIn('credentials', { ...parsed.data, redirectTo: LANDING });
  } catch (error) {
    // A successful sign-in throws a NEXT_REDIRECT which must propagate.
    if (error instanceof AuthError) return 'Invalid email or password.';
    throw error;
  }
}

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  name: z.string().trim().optional(),
  invite: z.string().min(1, 'An invite code is required.'),
});

export async function signUpAction(
  _prev: string | undefined,
  formData: FormData,
): Promise<string | undefined> {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
    invite: formData.get('invite'),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Check your details and try again.';
  }
  const { email, password, name, invite } = parsed.data;

  const inviteInfo = await peekInvite(invite);
  if (!inviteInfo) return 'Invalid or already-used invite code.';

  if (await getUserByEmail(email)) return 'An account with that email already exists.';

  const passwordHash = await bcrypt.hash(password, 10);
  const { id } = await createUser({ email, name: name ?? null, passwordHash, role: inviteInfo.role });

  if (!(await consumeInvite(invite, id))) {
    return 'That invite code was just used. Please request another.';
  }

  try {
    await signIn('credentials', { email, password, redirectTo: LANDING });
  } catch (error) {
    if (error instanceof AuthError) return 'Account created — please sign in.';
    throw error;
  }
}
