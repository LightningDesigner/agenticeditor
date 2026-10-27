// The film manifest: film/film.json. One file every agent and the editor read; sections own their beats.
import { z } from "zod";

export const BeatSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "beat ids are kebab-case"),
  label: z.string().optional(),
  // position inside the section, on the musical grid: bar 0 beat 0 is the section's first frame
  bar: z.number().min(0),
  beat: z.number().min(0).default(0),
});

export const SectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "section ids are kebab-case"),
  title: z.string().optional(),
  // file under film/sections/, without extension; defaults to the id
  component: z.string().optional(),
  bars: z.number().positive(),
  beats: z.array(BeatSchema).default([]),
  // free-form intent for the agent that owns it: what this section must say, references, Paper/Figma links
  intent: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const ManifestSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string().default("v1"),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1080),
  bpm: z.number().positive().default(120),
  beatsPerBar: z.number().int().positive().default(4),
  // optional soundtrack, path under film/
  audio: z.string().optional(),
  sections: z.array(SectionSchema).min(1),
});

export type Beat = z.infer<typeof BeatSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export function parseManifest(json: unknown): Manifest {
  return ManifestSchema.parse(json);
}
