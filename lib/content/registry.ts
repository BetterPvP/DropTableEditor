import type { ContentType } from '@/lib/db/types';

/**
 * The content-type registry — the single place that knows the set of authorable
 * content types. Routing (`/[type]`), navigation, and (in later phases) editor
 * selection and default factories all derive from this. Adding a new content
 * type is a new entry here plus its schema/editor — never new plumbing.
 */
export type EditorKind = 'form' | 'graph' | 'timeline';

export interface ContentTypeDef {
  type: ContentType;
  /** URL segment, e.g. "loot-tables". */
  slug: string;
  label: string;
  plural: string;
  /** Key into nav-icon's icon map. */
  icon: string;
  editorKind: EditorKind;
  description: string;
}

export const CONTENT_TYPES: ContentTypeDef[] = [
  {
    type: 'loot_table', slug: 'loot-tables', label: 'Loot Table', plural: 'Loot Tables',
    icon: 'grid', editorKind: 'form', description: 'Weighted drop tables with pity, progressive weighting and expressions.',
  },
  {
    type: 'saga', slug: 'sagas', label: 'Saga', plural: 'Storylines',
    icon: 'map', editorKind: 'graph', description: 'Quest dependency graphs that form a storyline.',
  },
  {
    type: 'quest', slug: 'quests', label: 'Quest', plural: 'Quests',
    icon: 'flag', editorKind: 'graph', description: 'Stages, requirements, scope and rewards.',
  },
  {
    type: 'conversation', slug: 'conversations', label: 'Conversation', plural: 'Conversations',
    icon: 'message', editorKind: 'graph', description: 'Branching dialogue with responses, voice and delays.',
  },
  {
    type: 'cinematic', slug: 'cinematics', label: 'Cinematic', plural: 'Cinematics',
    icon: 'film', editorKind: 'timeline', description: 'Camera and timeline-driven cutscenes.',
  },
];

export function contentTypeBySlug(slug: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((c) => c.slug === slug);
}

export function contentTypeByType(type: ContentType): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((c) => c.type === type);
}
