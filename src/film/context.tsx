import React, { createContext, useContext } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Timeline, TimelineSection } from "../core/timeline";

type Ctx = { timeline: Timeline; section: TimelineSection; props: Record<string, unknown> };
const SectionContext = createContext<Ctx | null>(null);

export function SectionProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <SectionContext.Provider value={value}>{children}</SectionContext.Provider>;
}

// Everything a section needs to draw frame t as a pure function of t, in its own local time.
export function useSection() {
  const ctx = useContext(SectionContext);
  if (!ctx) throw new Error("useSection() must be used inside a agenticeditor section");
  const frame = useCurrentFrame(); // local to the section's <Sequence>
  const { fps } = useVideoConfig();
  const { timeline, section, props } = ctx;
  const beatFrame = (id: string) => {
    const b = section.beats.find((x) => x.id === id);
    if (!b) throw new Error(`section "${section.id}" has no beat "${id}"; add it to film.json`);
    return b.frame - section.from;
  };
  return {
    id: section.id,
    frame,
    fps,
    globalFrame: section.from + frame,
    durationInFrames: section.durationInFrames,
    progress: frame / Math.max(1, section.durationInFrames - 1),
    framesPerBeat: timeline.framesPerBeat,
    framesPerBar: timeline.framesPerBar,
    // musical position inside the section, 0-based and fractional: bar 1.5 is halfway through the second bar
    bar: frame / timeline.framesPerBar,
    beatIndex: frame / timeline.framesPerBeat,
    beat: beatFrame,
    // frames since a named beat: negative before it. The usual way to start motion "on the drop".
    since: (id: string) => frame - beatFrame(id),
    props,
  };
}
