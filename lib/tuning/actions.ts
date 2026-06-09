'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { tuningBySlug } from './registry';
import { upsertTuningRow, deleteTuningRow } from '@/lib/db/repositories/tuning';

async function requireUser(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
}

export type SaveTuningResult = { ok: true } | { ok: false; error: string };

export async function saveTuningRowAction(
  slug: string,
  key: string,
  definitionText: string,
): Promise<SaveTuningResult> {
  await requireUser();
  const def = tuningBySlug(slug);
  if (!def) return { ok: false, error: 'Unknown tuning table.' };
  if (!key.trim()) return { ok: false, error: 'Key is required.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(definitionText);
  } catch {
    return { ok: false, error: 'Definition is not valid JSON.' };
  }

  await upsertTuningRow(def.table, def.keyColumn, key.trim(), parsed);
  revalidatePath(`/tuning/${slug}`);
  return { ok: true };
}

export async function deleteTuningRowAction(slug: string, key: string): Promise<void> {
  await requireUser();
  const def = tuningBySlug(slug);
  if (!def) return;
  await deleteTuningRow(def.table, def.keyColumn, key);
  revalidatePath(`/tuning/${slug}`);
}
