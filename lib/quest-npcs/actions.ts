'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { upsertQuestNpc, deleteQuestNpc, type QuestNpcRow } from '@/lib/db/repositories/quest-npcs';

async function requireUser(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
}

export type ActionResult = { ok: true } | { ok: false; error: string };
export type SkinResult = { ok: true; value: string; signature: string | null } | { ok: false; error: string };

export async function saveQuestNpcAction(npc: QuestNpcRow): Promise<ActionResult> {
  await requireUser();
  if (!npc.id.trim()) return { ok: false, error: 'NPC id is required (this is the Mapper data-point name).' };
  if (npc.source === 'human' && !npc.skinValue) return { ok: false, error: 'A Human NPC needs a skin.' };
  if (npc.source === 'factory' && (!npc.factory || !npc.type)) return { ok: false, error: 'Pick a factory + type.' };

  await upsertQuestNpc({ ...npc, id: npc.id.trim() });
  revalidatePath('/quest-npcs');
  return { ok: true };
}

export async function deleteQuestNpcAction(id: string): Promise<void> {
  await requireUser();
  await deleteQuestNpc(id);
  revalidatePath('/quest-npcs');
}

/** Pull a signed skin (value + signature) from a Minecraft player's profile. */
export async function fetchPlayerSkinAction(playerName: string): Promise<SkinResult> {
  await requireUser();
  const name = playerName.trim();
  if (!name) return { ok: false, error: 'Enter a player name.' };
  try {
    const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`);
    if (!profileRes.ok) return { ok: false, error: `No such player: ${name}` };
    const { id } = await profileRes.json();
    const texRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}?unsigned=false`);
    if (!texRes.ok) return { ok: false, error: 'Could not fetch the skin.' };
    const data = await texRes.json();
    const texture = (data.properties ?? []).find((p: { name: string }) => p.name === 'textures');
    if (!texture?.value) return { ok: false, error: 'That profile has no skin texture.' };
    return { ok: true, value: texture.value, signature: texture.signature ?? null };
  } catch {
    return { ok: false, error: 'Failed to reach Mojang.' };
  }
}

/** Turn an uploaded PNG (base64) into a signed skin via MineSkin. */
export async function uploadSkinAction(base64Png: string): Promise<SkinResult> {
  await requireUser();
  try {
    const buffer = Buffer.from(base64Png.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const form = new FormData();
    form.append('file', new Blob([buffer], { type: 'image/png' }), 'skin.png');
    const headers: Record<string, string> = {};
    if (process.env.MINESKIN_API_KEY) headers['Authorization'] = `Bearer ${process.env.MINESKIN_API_KEY}`;

    const res = await fetch('https://api.mineskin.org/generate/upload', { method: 'POST', body: form, headers });
    const data = await res.json();
    const texture = data?.data?.texture;
    if (!texture?.value) return { ok: false, error: data?.errorMessage || 'MineSkin upload failed.' };
    return { ok: true, value: texture.value, signature: texture.signature ?? null };
  } catch {
    return { ok: false, error: 'Failed to reach MineSkin (set MINESKIN_API_KEY if rate-limited).' };
  }
}
