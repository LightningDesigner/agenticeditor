import React from "react";
import { AbsoluteFill } from "remotion";
import { useSection, tween, ease } from "agenticeditor";

export default function Outro() {
  const s = useSection();
  const t = s.since("title");
  const y = tween(t, [0, s.framesPerBeat * 2], [30, 0], ease.out);
  const o = tween(t, [0, s.framesPerBeat], [0, 1]);
  const rule = tween(t, [s.framesPerBeat, s.framesPerBeat * 3], [0, 100], ease.inOut);
  return (
    <AbsoluteFill style={{ background: "#3355ff", alignItems: "center", justifyContent: "center", color: "#fff", font: "500 120px ui-monospace, Menlo, monospace" }}>
      <div style={{ opacity: o, transform: `translateY(${y}px)`, textAlign: "center" }}>
        agenticeditor.
        <div style={{ height: 6, background: "#fff", width: `${rule}%`, margin: "18px auto" }} />
        <div style={{ fontSize: 34, opacity: 0.85 }}>films as code, edited by agents</div>
      </div>
    </AbsoluteFill>
  );
}
