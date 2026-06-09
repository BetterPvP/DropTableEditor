'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { tuningBySlug } from './registry';
import { saveDraftTuningRow, publishTuningRow, deleteTuningRow } from '@/lib/db/repositories/tuning';

async function requireUser(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
}

export type TuningResult = { ok: true } | { ok: false; error: string };

function parse(slug: string, definitionText: string): { ok: true; def: NonNullable<ReturnType<typeof tuningBySlug>>; value: unknown } | { ok: false; error: string } {
  const def = tuningBySlug(slug);
  if (!def) return { ok: false, error: 'Unknown tuning table.' };
  try {
    return { ok: true, def, value: JSON.parse(definitionText) };
  } catch {
    return { ok: false, error: 'Definition is not valid JSON.' };
  }
}

/** Save the editor draft. Not live until published. */
export async function saveTuningRowAction(slug: string, key: string, definitionText: string): Promise<TuningResult> {
  await requireUser();
  if (!key.trim()) return { ok: false, error: 'Key is required.' };
  const parsed = parse(slug, definitionText);
  if (!parsed.ok) return parsed;

  await saveDraftTuningRow(parsed.def.table, parsed.def.keyColumn, key.trim(), parsed.value);
  revalidatePath(`/tuning/${slug}`);
  return { ok: true };
}

/** Save the draft and push it live (the game hot-reloads). */
export async function publishTuningRowAction(slug: string, key: string, definitionText: string): Promise<TuningResult> {
  await requireUser();
  if (!key.trim()) return { ok: false, error: 'Key is required.' };
  const parsed = parse(slug, definitionText);
  if (!parsed.ok) return parsed;

  await publishTuningRow(parsed.def.table, parsed.def.keyColumn, key.trim(), parsed.value);
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
