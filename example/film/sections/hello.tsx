import React from "react";
import { AbsoluteFill } from "remotion";
import { useSection, pulse, tween, ease } from "agenticeditor";

export default function Hello({ word = "hello" }: { word?: string }) {
  const s = useSection();
  const typed = Math.max(0, Math.min(word.length, Math.floor(s.since("type") / s.framesPerBeat) + 1));
  const done = s.since("done") >= 0;
  const blink = done ? (Math.floor(s.beatIndex) % 2 === 0 ? 1 : 0) : pulse(s.frame, s.framesPerBeat, 3);
  const settle = tween(s.since("done"), [0, s.framesPerBar], [0, -40], ease.out);
  return (
    <AbsoluteFill style={{ background: "#fff", alignItems: "center", justifyContent: "center" }}>
      <div style={{ font: "500 150px ui-monospace, Menlo, monospace", color: "#111", transform: `translateY(${settle}px)`, letterSpacing: -4 }}>
        {word.slice(0, typed)}
        <span style={{ opacity: blink, color: "#3355ff" }}>▌</span>
      </div>
    </AbsoluteFill>
  );
}
