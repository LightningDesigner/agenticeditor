import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Film } from "../film/Film";
import { barBeatAt, buildTimeline, frameRef, sectionAt, timecode, type Timeline as TL } from "../core/timeline";
import type { Note } from "../core/state";
import { manifest as genManifest, sections } from "@ae-gen";
import { api, getAuthor, setAuthor, useReelState } from "./api";
import { Timeline } from "./Timeline";
import { Inspector, Layers } from "./Panels";

export function App() {
  const { state, live } = useReelState();
  // the live manifest from disk; the generated one only until the first fetch lands
  const manifest = state?.manifest ?? genManifest;
  const tl = useMemo(() => buildTimeline(manifest), [manifest]);
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hold, setHold] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number; frame: number } | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const [author, setAuthorState] = useState(getAuthor);
  const [toast, setToast] = useState<string | null>(null);
  const [hud, setHud] = useState(true);

  const current = sectionAt(tl, frame);
  const notes = state?.notes ?? [];
  const claims = state?.claims ?? {};

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("seeked", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("seeked", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
    };
  }, []);

  const seek = useCallback(
    (f: number) => {
      const clamped = Math.max(0, Math.min(tl.durationInFrames - 1, Math.round(f)));
      player.current?.seekTo(clamped);
      setFrame(clamped);
    },
    [tl.durationInFrames],
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const copyRef = useCallback(() => {
    const ref = frameRef(manifest, tl, frame);
    navigator.clipboard?.writeText(ref).then(() => flash(`copied · ${ref}`), () => flash(ref));
  }, [manifest, tl, frame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      const step = e.shiftKey ? 10 : 1;
      const beats = tl.beats.map((b) => b.frame).concat(tl.sections.map((s) => s.from)).sort((a, b) => a - b);
      if (e.key === " ") (e.preventDefault(), player.current?.toggle());
      else if (e.key === "ArrowRight") (e.preventDefault(), seek(frame + step));
      else if (e.key === "ArrowLeft") (e.preventDefault(), seek(frame - step));
      else if (e.key === "]") seek(beats.find((b) => b > frame) ?? frame);
      else if (e.key === "[") seek([...beats].reverse().find((b) => b < frame) ?? 0);
      else if (e.key === "Home") seek(0);
      else if (e.key === "End") seek(tl.durationInFrames - 1);
      else if (e.key.toLowerCase() === "h") setHold((h) => !h);
      else if (e.key.toLowerCase() === "n") setNoteMode((n) => !n);
      else if (e.key.toLowerCase() === "c") copyRef();
      else if (e.key === "Escape") (setDraft(null), setNoteMode(false));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [frame, seek, tl, copyRef]);

  const audioSrc = manifest.audio ? `/files/film/${manifest.audio}` : undefined;
  const inputProps = useMemo(() => ({ manifest, sections, audioSrc }), [manifest, audioSrc]);
  const bb = barBeatAt(tl, frame);
  const openCount = notes.filter((n) => n.status === "open").length;
  const errors = (state?.findings ?? []).filter((f) => f.level === "error");
  const stops = useMemo(() => [...new Set(tl.beats.map((b) => b.frame).concat(tl.sections.map((s) => s.from)))].sort((a, b) => a - b), [tl]);
  const prevBeat = () => seek([...stops].reverse().find((b) => b < frame) ?? 0);
  const nextBeat = () => seek(stops.find((b) => b > frame) ?? frame);
  const beatNow = [...current.beats].reverse().find((b) => b.frame <= frame);
  const bars = Math.ceil(tl.durationInFrames / tl.framesPerBar);

  return (
    <div className="app">
      <header className="top">
        <span className="logo" aria-hidden />
        <span className="title">
          {manifest.id} <span className="dim">/ {manifest.version}</span>
        </span>
        <span className="seg">
          <span className="on">film · {tl.sections.length} sections</span>
          <span>{manifest.bpm} bpm</span>
        </span>
        <button className="ctl" onClick={prevBeat} title="Previous beat ([)">
          ◂
        </button>
        <button className="play" onClick={() => player.current?.toggle()} title="Play / pause (Space)">
          {playing ? "▌▌ pause" : "▶ play"}
        </button>
        <button className="ctl" onClick={nextBeat} title="Next beat (])">
          ▸
        </button>
        <button className="tc" onClick={copyRef} title="Copy frame reference (C)">
          {timecode(frame, tl.fps)}
        </button>
        <span className="dim">
          bar {bb.bar}.{bb.beat}
        </span>
        <span className="pill">{current.id}</span>
        <span className="grow" />
        <span className={`stat ${openCount ? "warn" : ""}`} title="Open notes">
          notes {openCount}
        </span>
        <span className={`stat ${errors.length ? "bad" : ""}`} title={errors.map((e) => `${e.where}: ${e.message}`).join("\n") || "agenticeditor check passes"}>
          check {errors.length ? `✗ ${errors.length}` : "✓"}
        </span>
        <span className={`stat live-stat ${live ? "" : "bad"}`} title={live ? "Agent changes appear as they happen" : "Disconnected from the dev server"}>
          {live ? "● live" : "○ offline"}
        </span>
        <button className={`ctl wide ${hold ? "on" : ""}`} onClick={() => setHold(!hold)} title="Loop the current section (H)">
          hold section
        </button>
        <button className={`ctl wide ${noteMode ? "on" : ""}`} onClick={() => setNoteMode(!noteMode)} title="Click the frame to pin a note (N)">
          + note
        </button>
        <button className={`ctl wide ${hud ? "on" : ""}`} onClick={() => setHud(!hud)} title="Readout over the frame">
          hud
        </button>
        <label className="author" title="Your name on notes">
          <input aria-label="Your name on notes" value={author} onChange={(e) => (setAuthorState(e.target.value), setAuthor(e.target.value))} />
        </label>
      </header>

      <Layers
        tl={tl}
        manifest={manifest}
        claims={claims}
        notes={notes}
        current={current.id}
        frame={frame}
        versions={state?.versions ?? []}
        onSeek={seek}
      />

      <main className="stage box">
        <div className="box-head">
          <span>
            canvas · <span className="blue">remotion</span> {tl.width} × {tl.height} · {tl.fps} fps · frame {frame}
          </span>
          <span className="blue">{noteMode ? "click the frame to pin a note · esc" : `film/sections/${current.component}.tsx`}</span>
        </div>
        <Canvas
          tl={tl}
          frame={frame}
          notes={notes}
          noteMode={noteMode}
          focusNote={focusNote}
          onPin={(x, y) => setDraft({ x, y, frame })}
          onPickNote={(n) => (setFocusNote(n.id), n.target.frame != null && seek(n.target.frame))}
        >
          <Player
            ref={player}
            component={Film as never}
            inputProps={inputProps as never}
            durationInFrames={tl.durationInFrames}
            compositionWidth={tl.width}
            compositionHeight={tl.height}
            fps={tl.fps}
            controls={false}
            clickToPlay={false}
            loop
            inFrame={hold ? current.from : null}
            outFrame={hold ? current.from + current.durationInFrames - 1 : null}
            style={{ width: "100%", height: "100%" }}
            acknowledgeRemotionLicense
          />
          {hud ? (
            <div className="hud">
              <div>
                t {(frame / tl.fps).toFixed(2)} · bar {bb.bar}.{bb.beat} · {beatNow?.id ?? current.id}
              </div>
              <div className="dim">
                section {current.id} · {claims[current.id]?.agent ?? "unowned"} · {bars} bars
              </div>
            </div>
          ) : null}
          {draft ? (
            <NoteDraft
              x={draft.x}
              y={draft.y}
              onCancel={() => setDraft(null)}
              onSave={async (body) => {
                const s = sectionAt(tl, draft.frame);
                const beat = [...s.beats].reverse().find((b) => b.frame <= draft.frame);
                await api.addNote({ section: s.id, beat: beat?.id, frame: draft.frame, x: draft.x, y: draft.y }, body, author);
                setDraft(null);
                setNoteMode(false);
              }}
            />
          ) : null}
        </Canvas>
        {state?.error ? <div className="banner">film.json: {state.error}</div> : null}
      </main>

      <Inspector
        tl={tl}
        manifest={manifest}
        section={current}
        claims={claims}
        notes={notes}
        log={state?.log ?? []}
        findings={state?.findings ?? []}
        focusNote={focusNote}
        author={author}
        onSeek={seek}
        onFocusNote={setFocusNote}
      />

      <Timeline tl={tl} frame={frame} notes={notes} claims={claims} current={current.id} hold={hold ? current.id : null} onSeek={seek} onPickNote={(n) => setFocusNote(n.id)} />
      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

// Fits the composition into the stage and overlays note pins at their normalized positions.
function Canvas(props: {
  tl: TL;
  frame: number;
  notes: Note[];
  noteMode: boolean;
  focusNote: string | null;
  onPin: (x: number, y: number) => void;
  onPickNote: (n: Note) => void;
  children: React.ReactNode;
}) {
  const { tl, frame, notes, noteMode } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      const scale = Math.min(width / tl.width, height / tl.height);
      setBox({ w: tl.width * scale, h: tl.height * scale });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tl.width, tl.height]);
  // pins show on the frame they were left on and a few frames either side
  const pins = notes.filter((n) => n.target.x != null && n.target.frame != null && Math.abs(n.target.frame - frame) <= 3);
  return (
    <div className="canvas-wrap" ref={wrap}>
      <div className="canvas-shadow" style={{ width: box.w, height: box.h }} />
      <div className={`canvas ${noteMode ? "pinning" : ""}`} style={{ width: box.w, height: box.h }}>
        {props.children}
        {noteMode ? (
          <div
            className="pin-layer"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              props.onPin((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
            }}
          />
        ) : null}
        {pins.map((n) => (
          <button
            key={n.id}
            className={`pin ${n.status} ${props.focusNote === n.id ? "focus" : ""}`}
            style={{ left: `${n.target.x! * 100}%`, top: `${n.target.y! * 100}%` }}
            onClick={() => props.onPickNote(n)}
            title={`${n.author}: ${n.body}`}
          >
            {n.id.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteDraft({ x, y, onSave, onCancel }: { x: number; y: number; onSave: (body: string) => void; onCancel: () => void }) {
  const [body, setBody] = useState("");
  return (
    <form
      className="draft"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSave(body.trim());
      }}
    >
      <textarea
        autoFocus
        value={body}
        placeholder="what should change here?"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), body.trim() && onSave(body.trim()));
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="row">
        <button type="button" className="ctl wide" onClick={onCancel}>
          cancel
        </button>
        <button className="ctl wide on">pin note</button>
      </div>
    </form>
  );
}
