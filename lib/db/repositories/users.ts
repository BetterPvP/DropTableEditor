import { db } from '../client';
import type { UserRole } from '../types';

/** User + invite-code access for the Credentials auth flow. */

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  password_hash: string | null;
  role: UserRole;
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const row = await db
    .selectFrom('users')
    .select(['id', 'name', 'email', 'password_hash', 'role'])
    .where('email', '=', email.toLowerCase())
    .executeTakeFirst();
  if (!row || !row.email) return null;
  return { ...row, email: row.email } as AuthUser;
}

export async function createUser(params: {
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
}): Promise<{ id: string }> {
  const row = await db
    .insertInto('users')
    .values({
      email: params.email.toLowerCase(),
      name: params.name,
      password_hash: params.passwordHash,
      role: params.role,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

/** Validate an unused invite code; returns its granted role or null. */
export async function peekInvite(code: string): Promise<{ role: UserRole } | null> {
  const row = await db
    .selectFrom('invite_codes')
    .select(['role', 'used_at'])
    .where('code', '=', code)
    .executeTakeFirst();
  if (!row || row.used_at) return null;
  return { role: row.role };
}

/** Atomically consume an invite code. Returns false if already used/missing. */
export async function consumeInvite(code: string, usedBy: string): Promise<boolean> {
  const result = await db
    .updateTable('invite_codes')
    .set({ used_at: new Date(), used_by: usedBy })
    .where('code', '=', code)
    .where('used_at', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows) === 1;
}
