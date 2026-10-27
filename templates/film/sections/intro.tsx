import React from "react";
import { AbsoluteFill } from "remotion";
import { useSection, tween, ease } from "agenticeditor";

export default function Intro() {
  const s = useSection();
  const o = tween(s.since("in"), [0, s.framesPerBeat * 2], [0, 1], ease.out);
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center", font: "500 96px ui-monospace, monospace", opacity: o }}>
      intro
    </AbsoluteFill>
  );
}
