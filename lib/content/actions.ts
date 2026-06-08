'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { contentTypeBySlug } from './registry';
import { CONTENT_SCHEMAS } from './schemas';
import { createContent, deleteContent, saveDraft } from '@/lib/db/repositories/content';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

export async function createContentAction(slug: string, formData: FormData): Promise<void> {
  const def = contentTypeBySlug(slug);
  if (!def) throw new Error(`Unknown content type: ${slug}`);
  const userId = await requireUserId();

  const name = String(formData.get('name') ?? '').trim() || `New ${def.label}`;

  // Insert first to obtain the row id, then seed the draft with the type's
  // default factory (the definition id mirrors the content row id).
  const { id } = await createContent({ type: def.type, name, draft: {}, userId });
  const draft = CONTENT_SCHEMAS[def.type].makeDefault(id, name);
  await saveDraft({ id, draft, baseRevision: 0, userId });

  revalidatePath(`/${slug}`);
  redirect(`/${slug}/${id}`);
}

export async function deleteContentAction(slug: string, id: string): Promise<void> {
  await requireUserId();
  await deleteContent(id);
  revalidatePath(`/${slug}`);
  redirect(`/${slug}`);
}
