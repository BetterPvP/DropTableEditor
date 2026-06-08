import { z } from 'zod';

export const cinematicTrackKinds = ['camera', 'subtitle', 'sound', 'action'] as const;
export type CinematicTrackKind = (typeof cinematicTrackKinds)[number];

export const keyframeSchema = z.object({
  id: z.string(),
  tick: z.number().int().nonnegative(),
  data: z.record(z.unknown()).default({}),
});

export const trackSchema = z.object({
  id: z.string(),
  kind: z.enum(cinematicTrackKinds),
  label: z.string().default(''),
  keyframes: z.array(keyframeSchema).default([]),
});

export const cinematicSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  durationTicks: z.number().int().nonnegative().default(200),
  tracks: z.array(trackSchema).default([]),
});

export type CinematicDefinition = z.infer<typeof cinematicSchema>;
export type CinematicTrack = z.infer<typeof trackSchema>;
export type Keyframe = z.infer<typeof keyframeSchema>;

export function makeDefaultCinematic(id: string, name: string) {
  return {
    id, name, durationTicks: 200,
    tracks: [
      { id: 'camera', kind: 'camera', label: 'Camera', keyframes: [] },
      { id: 'subtitle', kind: 'subtitle', label: 'Subtitles', keyframes: [] },
    ],
  };
}
