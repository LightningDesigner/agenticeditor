// Turns a manifest into frames. Everything is on one BPM grid so music, sections and beats line up,
// and "the drop" is a beat id an agent can name instead of a timestamp it has to guess.
import type { Manifest } from "./manifest";

export type TimelineBeat = { id: string; key: string; label: string; section: string; frame: number };
export type TimelineSection = {
  id: string;
  title: string;
  component: string;
  index: number;
  from: number;
  durationInFrames: number;
  beats: TimelineBeat[];
};
export type Timeline = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  framesPerBeat: number;
  framesPerBar: number;
  sections: TimelineSection[];
  beats: TimelineBeat[];
};

export function buildTimeline(m: Manifest): Timeline {
  const framesPerBeat = (60 / m.bpm) * m.fps;
  const framesPerBar = framesPerBeat * m.beatsPerBar;
  let cursor = 0;
  const sections: TimelineSection[] = m.sections.map((s, index) => {
    const from = Math.round(cursor);
    cursor += s.bars * framesPerBar;
    const durationInFrames = Math.round(cursor) - from;
    const beats = s.beats.map((b) => ({
      id: b.id,
      key: `${s.id}.${b.id}`,
      label: b.label ?? b.id,
      section: s.id,
      frame: from + Math.round(b.bar * framesPerBar + b.beat * framesPerBeat),
    }));
    return { id: s.id, title: s.title ?? s.id, component: s.component ?? s.id, index, from, durationInFrames, beats };
  });
  return {
    fps: m.fps,
    width: m.width,
    height: m.height,
    durationInFrames: Math.round(cursor),
    framesPerBeat,
    framesPerBar,
    sections,
    beats: sections.flatMap((s) => s.beats),
  };
}

export function sectionAt(tl: Timeline, frame: number): TimelineSection {
  return tl.sections.find((s) => frame >= s.from && frame < s.from + s.durationInFrames) ?? tl.sections[tl.sections.length - 1];
}

export function timecode(frame: number, fps: number): string {
  const s = Math.floor(frame / fps);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(frame % fps)}`;
}

export function barBeatAt(tl: Timeline, frame: number): { bar: number; beat: number } {
  const bar = Math.floor(frame / tl.framesPerBar);
  const beat = Math.floor((frame - bar * tl.framesPerBar) / tl.framesPerBeat);
  return { bar: bar + 1, beat: beat + 1 };
}

// "f120", "120", "4.5s", "intro", "intro.drop" -> frame. Lets agents and humans name frames the same way.
export function resolveFrameRef(tl: Timeline, ref: string): number {
  const r = ref.trim();
  if (/^f?\d+$/.test(r)) return Number(r.replace(/^f/, ""));
  if (/^\d+(\.\d+)?s$/.test(r)) return Math.round(parseFloat(r) * tl.fps);
  const beat = tl.beats.find((b) => b.key === r);
  if (beat) return beat.frame;
  const section = tl.sections.find((s) => s.id === r);
  if (section) return section.from;
  throw new Error(`can't resolve frame "${ref}": use a frame (f120), seconds (4.5s), a section id or section.beat`);
}

// The reference a human or agent copies to point at one frame, e.g. "demo v2 · f132 · 00:04:12 · grid · grid.fill".
export function frameRef(m: Manifest, tl: Timeline, frame: number): string {
  const s = sectionAt(tl, frame);
  const beat = [...s.beats].reverse().find((b) => b.frame <= frame);
  return [`${m.id} ${m.version}`, `f${frame}`, timecode(frame, tl.fps), s.id, beat?.key].filter(Boolean).join(" · ");
}
