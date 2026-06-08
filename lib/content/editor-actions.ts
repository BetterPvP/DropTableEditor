'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import type { ContentType } from '@/lib/db/types';
import { CONTENT_SCHEMAS } from './schemas';
import { contentTypeByType } from './registry';
import {
  saveDraft, publishContent, listSnapshots, restoreSnapshot, duplicateContent,
  replaceContentLinks, type SnapshotSummary,
} from '@/lib/db/repositories/content';
import { itemKeysExist } from '@/lib/db/repositories/manifest';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

function formatIssues(error: import('zod').ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; stale: true; error: string; currentRevision: number }
  | { ok: false; stale: false; error: string; issues?: string[] };

/** Optimistic-locked autosave of a draft. Structurally validates first. */
export async function saveDraftAction(input: {
  id: string;
  type: ContentType;
  name: string;
  draft: unknown;
  baseRevision: number;
}): Promise<SaveResult> {
  const userId = await requireUserId();
  const parsed = CONTENT_SCHEMAS[input.type].schema.safeParse(input.draft);
  if (!parsed.success) {
    return { ok: false, stale: false, error: 'Draft failed validation.', issues: formatIssues(parsed.error) };
  }

  const result = await saveDraft({
    id: input.id, draft: parsed.data, name: input.name, baseRevision: input.baseRevision, userId,
  });
  if (!result.ok) {
    return {
      ok: false, stale: true,
      error: 'This content changed since you opened it — reload to continue.',
      currentRevision: result.currentRevision,
    };
  }
  return { ok: true, revision: result.revision };
}

export type PublishResult =
  | { ok: true; version: number }
  | { ok: false; error: string; issues?: string[] };

/** Validate fully, reference-check, copy draft→published, snapshot, NOTIFY. */
export async function publishAction(input: {
  id: string;
  type: ContentType;
  draft: unknown;
}): Promise<PublishResult> {
  const userId = await requireUserId();
  const def = CONTENT_SCHEMAS[input.type];

  const parsed = def.schema.safeParse(input.draft);
  if (!parsed.success) {
    return { ok: false, error: 'Cannot publish invalid content.', issues: formatIssues(parsed.error) };
  }

  if (def.referencedItemKeys) {
    const keys = def.referencedItemKeys(parsed.data);
    if (keys.length > 0) {
      const existing = await itemKeysExist(keys);
      const missing = keys.filter((k) => !existing.has(k));
      if (missing.length > 0) {
        return { ok: false, error: `References item(s) not in the game manifest: ${missing.join(', ')}` };
      }
    }
  }

  const { version } = await publishContent({ id: input.id, payload: parsed.data, userId });

  if (def.referencedContentIds) {
    await replaceContentLinks(input.id, def.referencedContentIds(parsed.data));
  }

  const td = contentTypeByType(input.type);
  if (td) {
    revalidatePath(`/${td.slug}`);
    revalidatePath(`/${td.slug}/${input.id}`);
  }
  return { ok: true, version };
}

export async function listSnapshotsAction(id: string): Promise<SnapshotSummary[]> {
  await requireUserId();
  return listSnapshots(id);
}

export async function restoreSnapshotAction(
  id: string,
  snapshotId: string,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const result = await restoreSnapshot({ id, snapshotId, userId });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, version: result.version };
}

export async function duplicateAction(
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const result = await duplicateContent({ id, userId });
  if ('error' in result) return { ok: false, error: result.error };
  return { ok: true, id: result.id };
}
