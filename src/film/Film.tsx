import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence } from "remotion";
import type { Manifest } from "../core/manifest";
import { buildTimeline } from "../core/timeline";
import { SectionProvider } from "./context";

export type SectionMap = Record<string, React.ComponentType<Record<string, unknown>>>;
export type FilmProps = { manifest: Manifest; sections: SectionMap; audioSrc?: string };

export function Film({ manifest, sections, audioSrc }: FilmProps) {
  const timeline = buildTimeline(manifest);
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {timeline.sections.map((s) => {
        const Comp = sections[s.component];
        const props = manifest.sections[s.index].props ?? {};
        return (
          <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.durationInFrames}>
            <SectionProvider value={{ timeline, section: s, props }}>
              {Comp ? <Comp {...props} /> : <Missing id={s.id} component={s.component} />}
            </SectionProvider>
          </Sequence>
        );
      })}
      {audioSrc ? <Audio src={audioSrc} /> : null}
    </AbsoluteFill>
  );
}

function Missing({ id, component }: { id: string; component: string }) {
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", font: "32px ui-monospace, monospace", color: "#999" }}>
      ┌ {id} ┐ no component: film/sections/{component}.tsx
    </AbsoluteFill>
  );
}

// Remotion root for stills and renders (the editor uses <Player> with <Film> directly). The film is bound in a
// closure, not passed as props, because section components can't be serialized into Remotion's input props.
export function makeRoot(fp: FilmProps) {
  const tl = buildTimeline(fp.manifest);
  const Bound: React.FC = () => <Film {...fp} />;
  return function ReelRoot() {
    return <Composition id="agenticeditor" component={Bound} durationInFrames={tl.durationInFrames} fps={tl.fps} width={tl.width} height={tl.height} />;
  };
}
