import React, { useState } from "react";
import type { Manifest } from "../core/manifest";
import type { Timeline, TimelineSection } from "../core/timeline";
import type { Claim, LogEntry, Note } from "../core/state";
import type { Finding } from "../core/check";
import { api } from "./api";

// Left: the film's structure as a tree. Sections, their beats when current, the current intent, agents, versions.
export function Layers(props: {
  tl: Timeline;
  manifest: Manifest;
  claims: Record<string, Claim>;
  notes: Note[];
  current: string;
  frame: number;
  versions: string[];
  onSeek: (f: number) => void;
}) {
  const { tl, manifest, claims, notes, current, frame } = props;
  const agents = Object.entries(claims);
  const cur = tl.sections.find((s) => s.id === current)!;
  const intent = manifest.sections[cur.index]?.intent;
  const barOf = (f: number) => `b${Math.floor(f / tl.framesPerBar) + 1}`;
  return (
    <aside className="left box">
      <div className="box-head">
        <span>
          layers · <span className="blue">film</span>
        </span>
      </div>
      <div className="scroll">
        <div className="caps">sections · {tl.sections.length}</div>
        <ul className="tree">
          {tl.sections.map((s) => {
            const open = notes.filter((n) => n.status === "open" && n.target.section === s.id).length;
            return (
              <React.Fragment key={s.id}>
                <li className={s.id === current ? "sel" : ""} onClick={() => props.onSeek(s.from)}>
                  <span className="mark">{s.id === current ? "▸" : "◦"}</span>
                  <span>{s.id}</span>
                  {open ? <span className="flag">{open}</span> : null}
                  <span className="grow" />
                  <span className="r">{barOf(s.from)}</span>
                </li>
                {s.id === current
                  ? s.beats.map((b) => (
                      <li key={b.key} className={`sub ${frame >= b.frame ? "" : "future"}`} onClick={() => props.onSeek(b.frame)}>
                        <span className="mark">└</span>
                        <span>{b.id}</span>
                        <span className="grow" />
                        <span className="r">f{b.frame}</span>
                      </li>
                    ))
                  : null}
              </React.Fragment>
            );
          })}
        </ul>

        <div className="callout">
          <div>{cur.title}</div>
          <div className="blue">{intent ?? "no intent yet · add one in film.json"}</div>
        </div>

        <div className="caps">agents · {agents.length}</div>
        {agents.length === 0 ? (
          <div className="quiet">no agents on the film</div>
        ) : (
          <ul className="tree">
            {agents.map(([section, c]) => (
              <li key={section} title={c.task} onClick={() => props.onSeek(tl.sections.find((s) => s.id === section)?.from ?? 0)}>
                <span className="mark on">●</span>
                <span>{c.agent}</span>
                <span className="grow" />
                <span className="r">{section}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="caps">versions · {props.versions.length + 1}</div>
        <div className="quiet">
          {props.versions.map((v) => (
            <span key={v}>{v} · </span>
          ))}
          <span className="blue">{manifest.version} working</span>
        </div>
      </div>
    </aside>
  );
}

// Right: the current section in detail, its notes, and what every agent has been doing.
export function Inspector(props: {
  tl: Timeline;
  manifest: Manifest;
  section: TimelineSection;
  claims: Record<string, Claim>;
  notes: Note[];
  log: LogEntry[];
  findings: Finding[];
  focusNote: string | null;
  author: string;
  onSeek: (f: number) => void;
  onFocusNote: (id: string | null) => void;
}) {
  const { section, manifest, claims, author, tl } = props;
  const def = manifest.sections[section.index];
  const [showResolved, setShowResolved] = useState(false);
  const notes = props.notes.filter((n) => n.target.section === section.id && (showResolved || n.status === "open"));
  const findings = props.findings.filter((f) => f.where.includes(section.id) || f.where.includes(section.component));
  return (
    <aside className="right box">
      <div className="box-head">
        <span>
          inspector · <span className="blue">{section.id}</span>
        </span>
        <span className="dim">{section.component}.tsx</span>
      </div>
      <div className="scroll">
        <dl className="kv">
          <dt>section</dt>
          <dd>{section.title}</dd>
          <dt>from</dt>
          <dd>
            f{section.from} · bar {Math.floor(section.from / tl.framesPerBar) + 1}
          </dd>
          <dt>length</dt>
          <dd>
            {def.bars} bars · {section.durationInFrames}f
          </dd>
          <dt>beats</dt>
          <dd>{section.beats.map((b) => b.id).join(" · ") || "none"}</dd>
          <dt>owner</dt>
          <dd className={claims[section.id] ? "blue" : "dim"}>{claims[section.id] ? `● ${claims[section.id].agent}` : "unowned"}</dd>
          {claims[section.id]?.task ? (
            <>
              <dt>task</dt>
              <dd>{claims[section.id].task}</dd>
            </>
          ) : null}
        </dl>
        {findings.map((f, i) => (
          <div key={i} className={`finding ${f.level}`}>
            {f.level === "error" ? "✗" : "!"} {f.message}
          </div>
        ))}

        <div className="caps row">
          <span>notes · {notes.length}</span>
          <label className="toggle">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            resolved
          </label>
        </div>
        {notes.length === 0 ? <div className="quiet">no notes · press N and click the frame</div> : null}
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} focus={props.focusNote === n.id} author={author} onSeek={props.onSeek} onFocus={() => props.onFocusNote(n.id)} />
        ))}

        <div className="caps">activity</div>
        {props.log.length === 0 ? <div className="quiet">nothing yet</div> : null}
        <ul className="log">
          {[...props.log].reverse().map((e, i) => (
            <li key={i}>
              <span className="dim">{e.at.slice(11, 16)}</span> <span className="blue">{e.agent}</span> {e.action}
              {e.detail ? <div className="dim detail">{e.detail}</div> : null}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function NoteCard({ note, focus, author, onSeek, onFocus }: { note: Note; focus: boolean; author: string; onSeek: (f: number) => void; onFocus: () => void }) {
  const [reply, setReply] = useState("");
  return (
    <div className={`note ${note.status} ${focus ? "focus" : ""}`} onClick={onFocus}>
      <div className="note-head">
        <span>{note.id}</span>
        <span className="blue">{note.author}</span>
        {note.target.frame != null ? (
          <button className="link" onClick={() => onSeek(note.target.frame!)}>
            f{note.target.frame}
          </button>
        ) : null}
        <span className="grow" />
        {note.status === "open" ? (
          <button className="link" onClick={() => api.resolve(note.id, author)}>
            resolve
          </button>
        ) : (
          <button className="link" onClick={() => api.reopen(note.id, author)}>
            reopen
          </button>
        )}
      </div>
      <div>{note.body}</div>
      {note.replies.map((r, i) => (
        <div key={i} className="reply">
          <span className="blue">{r.author}</span> {r.body}
          {r.render ? <img src={`/files/${r.render}`} alt={`render attached by ${r.author}`} /> : null}
        </div>
      ))}
      {focus ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) api.reply(note.id, reply.trim(), author).then(() => setReply(""));
          }}
        >
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="reply…" />
        </form>
      ) : null}
    </div>
  );
}
