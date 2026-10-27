import React, { useRef } from "react";
import type { Timeline as TL } from "../core/timeline";
import type { Claim, Note } from "../core/state";

// The arrangement: a strip of sections, the bar ruler, then one row each for beats, notes and owning agents.
// Drag anywhere to scrub; click a section to jump to its start.
export function Timeline(props: {
  tl: TL;
  frame: number;
  notes: Note[];
  claims: Record<string, Claim>;
  current: string;
  hold: string | null;
  onSeek: (f: number) => void;
  onPickNote: (n: Note) => void;
}) {
  const { tl, frame, notes, claims, current, hold } = props;
  const lanes = useRef<HTMLDivElement>(null);
  const pct = (f: number) => `${(f / tl.durationInFrames) * 100}%`;
  const bars = Math.ceil(tl.durationInFrames / tl.framesPerBar);

  const scrub = (e: React.PointerEvent) => {
    const el = lanes.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const at = (x: number) => props.onSeek(((x - r.left) / r.width) * tl.durationInFrames);
    at(e.clientX);
    const move = (ev: PointerEvent) => at(ev.clientX);
    const up = () => (window.removeEventListener("pointermove", move), window.removeEventListener("pointerup", up));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const cells = (key: string, render: (s: TL["sections"][number]) => React.ReactNode, cls: (s: TL["sections"][number]) => string) =>
    tl.sections.map((s) => (
      <div key={`${key}-${s.id}`} className={`cell ${cls(s)}`} style={{ left: pct(s.from), width: pct(s.durationInFrames) }}>
        {render(s)}
      </div>
    ));

  return (
    <section className="timeline box">
      <div className="box-head">
        <span>
          arrangement · {tl.sections.length} sections × {bars} bars · <span className="dim">click to seek, a section to jump</span>
        </span>
        <span className="dim">{hold ? `holding ${hold}` : ""}</span>
      </div>
      <div className="tl">
        <div className="tl-labels">
          <div />
          <div />
          <div>beats</div>
          <div>notes</div>
          <div>agents</div>
        </div>
        <div className="tl-lanes" ref={lanes} onPointerDown={scrub}>
          {Array.from({ length: bars + 1 }, (_, i) => (
            <div key={i} className={`gridline ${i % 4 === 0 ? "major" : ""}`} style={{ left: pct(i * tl.framesPerBar) }} />
          ))}
          <div className="lane strip">
            {cells(
              "sec",
              (s) => (
                <span>{s.id}</span>
              ),
              (s) => `${s.id === current ? "sel" : ""} ${hold === s.id ? "held" : ""}`,
            )}
          </div>
          <div className="lane ruler">
            {Array.from({ length: bars }, (_, i) => (
              <span key={i} style={{ left: pct(i * tl.framesPerBar) }}>
                {i + 1}
              </span>
            ))}
          </div>
          <div className="lane beats">
            {tl.beats.map((b) => (
              <span key={b.key} className="tick" style={{ left: pct(b.frame) }} title={`${b.key} · f${b.frame}`}>
                {b.id}
              </span>
            ))}
          </div>
          <div className="lane notes">
            {notes
              .filter((n) => n.target.frame != null)
              .map((n) => (
                <button
                  key={n.id}
                  className={`npin ${n.status}`}
                  style={{ left: pct(n.target.frame!) }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => (props.onSeek(n.target.frame!), props.onPickNote(n))}
                  title={`${n.author}: ${n.body}`}
                >
                  {n.id}
                </button>
              ))}
          </div>
          <div className="lane strip owners">
            {cells(
              "own",
              (s) => (
                <span>{claims[s.id]?.agent ?? "—"}</span>
              ),
              (s) => (claims[s.id] ? "owned" : "") + (s.id === current ? " sel" : ""),
            )}
          </div>
          <div className="playhead" style={{ left: pct(frame) }} />
        </div>
      </div>
    </section>
  );
}
