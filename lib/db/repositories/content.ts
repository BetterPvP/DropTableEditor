import { sql } from 'kysely';
import { db } from '../client';
import type { ContentStatus, ContentType } from '../types';

/**
 * Repository for the generalized `content` backbone. All content types
 * (loot_table, saga, quest, conversation, cinematic) flow through here. Pure
 * DB logic — schema validation lives in the server-action layer that calls it.
 */

export interface ContentSummary {
  id: string;
  type: ContentType;
  name: string;
  description: string | null;
  status: ContentStatus;
  version: number;
  revision: number;
  updated_at: Date;
}

export interface ContentRecord extends ContentSummary {
  draft: unknown;
  published: unknown | null;
  created_at: Date;
  published_at: Date | null;
}

export interface SnapshotSummary {
  id: string;
  version: number;
  label: string | null;
  created_at: Date;
  created_by: string | null;
}

const SUMMARY_COLUMNS = [
  'id', 'type', 'name', 'description', 'status', 'version', 'revision', 'updated_at',
] as const;

export async function listContent(type?: ContentType): Promise<ContentSummary[]> {
  let query = db.selectFrom('content').select(SUMMARY_COLUMNS);
  if (type) query = query.where('type', '=', type);
  const rows = await query.orderBy('updated_at', 'desc').execute();
  return rows as ContentSummary[];
}

export async function getContent(id: string): Promise<ContentRecord | null> {
  const row = await db
    .selectFrom('content')
    .select([
      'id', 'type', 'name', 'description', 'status', 'version', 'revision',
      'draft', 'published', 'created_at', 'updated_at', 'published_at',
    ])
    .where('id', '=', id)
    .executeTakeFirst();
  return (row as ContentRecord | undefined) ?? null;
}

export async function createContent(params: {
  type: ContentType;
  name: string;
  draft: unknown;
  description?: string | null;
  userId: string;
}): Promise<{ id: string }> {
  const row = await db
    .insertInto('content')
    .values({
      type: params.type,
      name: params.name,
      description: params.description ?? null,
      status: 'draft',
      draft: JSON.stringify(params.draft),
      created_by: params.userId,
      updated_by: params.userId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

export type SaveDraftResult =
  | { ok: true; revision: number }
  | { ok: false; stale: true; currentRevision: number };

/**
 * Optimistic-locked draft save. Succeeds only if the row's revision still
 * matches the revision the client loaded; otherwise reports stale so the client
 * can prompt a reload instead of clobbering a concurrent edit.
 */
export async function saveDraft(params: {
  id: string;
  draft: unknown;
  name?: string;
  description?: string | null;
  baseRevision: number;
  userId: string;
}): Promise<SaveDraftResult> {
  const nextRevision = params.baseRevision + 1;
  const result = await db
    .updateTable('content')
    .set({
      draft: JSON.stringify(params.draft),
      revision: nextRevision,
      updated_at: new Date(),
      updated_by: params.userId,
      ...(params.name !== undefined ? { name: params.name } : {}),
      ...(params.description !== undefined ? { description: params.description } : {}),
    })
    .where('id', '=', params.id)
    .where('revision', '=', params.baseRevision)
    .executeTakeFirst();

  if (Number(result.numUpdatedRows) === 0) {
    const current = await db
      .selectFrom('content').select('revision').where('id', '=', params.id)
      .executeTakeFirst();
    return { ok: false, stale: true, currentRevision: current?.revision ?? -1 };
  }
  return { ok: true, revision: nextRevision };
}

/**
 * Publish: copy the (validated) payload into `published`, bump version, write an
 * immutable snapshot, flip status, and NOTIFY so the game can hot-reload.
 */
export async function publishContent(params: {
  id: string;
  payload: unknown;
  label?: string;
  userId: string;
}): Promise<{ version: number }> {
  const version = await db.transaction().execute(async (trx) => {
    const current = await trx
      .selectFrom('content').select(['version']).where('id', '=', params.id)
      .executeTakeFirstOrThrow();
    const nextVersion = current.version + 1;
    const payloadJson = JSON.stringify(params.payload);

    await trx
      .updateTable('content')
      .set({
        published: payloadJson,
        version: nextVersion,
        status: 'published',
        published_at: new Date(),
        published_by: params.userId,
        updated_at: new Date(),
        updated_by: params.userId,
      })
      .where('id', '=', params.id)
      .execute();

    await trx
      .insertInto('content_snapshots')
      .values({
        content_id: params.id,
        version: nextVersion,
        payload: payloadJson,
        label: params.label ?? `Publish v${nextVersion}`,
        created_by: params.userId,
      })
      .execute();

    return nextVersion;
  });

  await notifyPublished(params.id);
  return { version };
}

export async function listSnapshots(id: string): Promise<SnapshotSummary[]> {
  const rows = await db
    .selectFrom('content_snapshots')
    .select(['id', 'version', 'label', 'created_at', 'created_by'])
    .where('content_id', '=', id)
    .orderBy('created_at', 'desc')
    .execute();
  return rows as SnapshotSummary[];
}

/** Restore a snapshot's payload back into `published` and NOTIFY the game. */
export async function restoreSnapshot(params: {
  id: string;
  snapshotId: string;
  userId: string;
}): Promise<{ version: number } | { error: string }> {
  const snapshot = await db
    .selectFrom('content_snapshots')
    .select(['payload', 'version'])
    .where('id', '=', params.snapshotId)
    .where('content_id', '=', params.id)
    .executeTakeFirst();
  if (!snapshot) return { error: 'Snapshot not found' };

  await db
    .updateTable('content')
    .set({
      published: JSON.stringify(snapshot.payload),
      status: 'published',
      published_at: new Date(),
      published_by: params.userId,
    })
    .where('id', '=', params.id)
    .execute();

  await notifyPublished(params.id);
  return { version: snapshot.version };
}

export async function duplicateContent(params: {
  id: string;
  userId: string;
}): Promise<{ id: string } | { error: string }> {
  const source = await getContent(params.id);
  if (!source) return { error: 'Content not found' };
  const row = await db
    .insertInto('content')
    .values({
      type: source.type,
      name: `${source.name} (Copy)`,
      description: source.description,
      status: 'draft',
      draft: JSON.stringify(source.draft),
      created_by: params.userId,
      updated_by: params.userId,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

export async function deleteContent(id: string): Promise<void> {
  await db.deleteFrom('content').where('id', '=', id).execute();
}

/** Rebuild the content_links adjacency cache for one source row. */
export async function replaceContentLinks(
  fromId: string,
  links: Array<{ toId: string; kind: string }>,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('content_links').where('from_content_id', '=', fromId).execute();
    if (links.length > 0) {
      await trx
        .insertInto('content_links')
        .values(links.map((l) => ({ from_content_id: fromId, to_content_id: l.toId, kind: l.kind })))
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  });
}

async function notifyPublished(id: string): Promise<void> {
  // Harmless no-op until the game LISTENs on this channel.
  await sql`select pg_notify('content_published', ${id})`.execute(db);
}

export interface ContentLinkRow {
  fromId: string;
  fromName: string;
  fromType: string;
  toId: string;
  toName: string | null;
  toType: string | null;
  kind: string;
}

/** All cross-references with both endpoints' names resolved (for Insights). */
export async function listAllContentLinks(): Promise<ContentLinkRow[]> {
  const links = await db
    .selectFrom('content_links')
    .select(['from_content_id', 'to_content_id', 'kind'])
    .execute();
  if (links.length === 0) return [];

  const ids = Array.from(new Set(links.flatMap((l) => [l.from_content_id, l.to_content_id])));
  const names = await db.selectFrom('content').select(['id', 'name', 'type']).where('id', 'in', ids).execute();
  const byId = new Map(names.map((n) => [n.id, n]));

  return links.map((l) => ({
    fromId: l.from_content_id,
    fromName: byId.get(l.from_content_id)?.name ?? l.from_content_id,
    fromType: byId.get(l.from_content_id)?.type ?? '',
    toId: l.to_content_id,
    toName: byId.get(l.to_content_id)?.name ?? null,
    toType: byId.get(l.to_content_id)?.type ?? null,
    kind: l.kind,
  }));
}

export interface TypeCount {
  type: string;
  total: number;
  published: number;
  draft: number;
}

/** Per-type draft/published tallies for the Insights overview. */
export async function contentCounts(): Promise<TypeCount[]> {
  const rows = await db.selectFrom('content').select(['type', 'status']).execute();
  const map = new Map<string, TypeCount>();
  for (const row of rows) {
    const entry = map.get(row.type) ?? { type: row.type, total: 0, published: 0, draft: 0 };
    entry.total += 1;
    if (row.status === 'published') entry.published += 1;
    else if (row.status === 'draft') entry.draft += 1;
    map.set(row.type, entry);
  }
  return Array.from(map.values());
}
