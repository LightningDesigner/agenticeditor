import React from "react";
import { AbsoluteFill } from "remotion";
import { useSection, blend, progress, rand, ease } from "agenticeditor";

const COLS = 6;
const ROWS = 6;
const GLYPHS = ["┌─┐", "│▓│", "╞═╡", "│░│", "└─┘", "├┼┤"];

export default function Grid() {
  const s = useSection();
  const dropAt = s.beat("drop");
  // one row lands per beat until the drop
  const rows = Math.min(ROWS, Math.floor(s.since("build") / s.framesPerBeat) + 1);
  const flip = progress(s.frame, dropAt, dropAt + s.framesPerBeat / 2, ease.out);
  const bg = blend("#ffffff", "#3355ff", flip);
  const fg = blend("#111111", "#ffffff", flip);
  return (
    <AbsoluteFill style={{ background: bg, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 18, font: "500 64px ui-monospace, Menlo, monospace", color: fg }}>
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const row = Math.floor(i / COLS);
          const visible = row < rows;
          const seed = i + Math.floor(Math.max(0, s.since("drop")) / s.framesPerBeat) * 97;
          return (
            <span key={i} style={{ opacity: visible ? 1 : 0.08, whiteSpace: "pre" }}>
              {GLYPHS[Math.floor(rand(seed) * GLYPHS.length)]}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
