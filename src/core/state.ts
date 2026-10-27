// Shared, on-disk state in <root>/.agenticeditor/. This is how several agents and one human coordinate without a server:
// claims (who owns which section), notes (reviews pinned to frames), and an append-only activity log.
// Node only. The editor reads it through the dev server.
import fs from "node:fs";
import path from "node:path";
import { parseManifest, type Manifest } from "./manifest";

export type Claim = { agent: string; since: string; task?: string };
export type NoteTarget = { section: string; beat?: string; frame?: number; x?: number; y?: number };
export type NoteReply = { author: string; body: string; at: string; render?: string };
export type Note = {
  id: string;
  target: NoteTarget;
  author: string;
  body: string;
  status: "open" | "resolved";
  at: string;
  replies: NoteReply[];
};
export type LogEntry = { at: string; agent: string; action: string; detail?: string };

export type Paths = ReturnType<typeof paths>;

export function paths(root: string) {
  const r = path.resolve(root);
  const dot = path.join(r, ".agenticeditor");
  return {
    root: r,
    film: path.join(r, "film"),
    manifest: path.join(r, "film", "film.json"),
    sections: path.join(r, "film", "sections"),
    dot,
    claims: path.join(dot, "claims.json"),
    notes: path.join(dot, "notes.json"),
    log: path.join(dot, "log.jsonl"),
    frames: path.join(dot, "frames"),
    versions: path.join(dot, "versions"),
    gen: path.join(dot, "gen"),
    lock: path.join(dot, "lock"),
  };
}

export function readManifest(p: Paths): Manifest {
  return parseManifest(JSON.parse(fs.readFileSync(p.manifest, "utf8")));
}

export function writeManifest(p: Paths, m: Manifest) {
  writeJson(p.manifest, m);
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file);
}

// Cross-process lock so two agents claiming at once can't both win. mkdir is atomic.
export function withLock<T>(p: Paths, fn: () => T): T {
  fs.mkdirSync(p.dot, { recursive: true });
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      fs.mkdirSync(p.lock);
      break;
    } catch {
      const age = Date.now() - (fs.statSync(p.lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > 30_000) fs.rmSync(p.lock, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new Error("state is locked by another agenticeditor process; try again");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  try {
    return fn();
  } finally {
    fs.rmSync(p.lock, { recursive: true, force: true });
  }
}

export const readClaims = (p: Paths) => readJson<Record<string, Claim>>(p.claims, {});
export const readNotes = (p: Paths) => readJson<Note[]>(p.notes, []);

export function readLog(p: Paths, limit = 200): LogEntry[] {
  if (!fs.existsSync(p.log)) return [];
  return fs
    .readFileSync(p.log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-limit)
    .map((l) => JSON.parse(l) as LogEntry);
}

export function log(p: Paths, agent: string, action: string, detail?: string) {
  fs.mkdirSync(p.dot, { recursive: true });
  const entry: LogEntry = { at: new Date().toISOString(), agent, action, detail };
  fs.appendFileSync(p.log, JSON.stringify(entry) + "\n");
}

export function claim(p: Paths, section: string, agent: string, task?: string): Claim {
  return withLock(p, () => {
    const m = readManifest(p);
    if (!m.sections.some((s) => s.id === section)) throw new Error(`no section "${section}"`);
    const claims = readClaims(p);
    const held = claims[section];
    if (held && held.agent !== agent) throw new Error(`"${section}" is owned by ${held.agent} since ${held.since}; ask for a handoff`);
    claims[section] = { agent, since: held?.since ?? new Date().toISOString(), task };
    writeJson(p.claims, claims);
    log(p, agent, "claim", task ? `${section}: ${task}` : section);
    return claims[section];
  });
}

export function release(p: Paths, section: string, agent: string, force = false) {
  withLock(p, () => {
    const claims = readClaims(p);
    const held = claims[section];
    if (!held) return;
    if (held.agent !== agent && !force) throw new Error(`"${section}" is owned by ${held.agent}, not ${agent}`);
    delete claims[section];
    writeJson(p.claims, claims);
    log(p, agent, "release", section);
  });
}

export function handoff(p: Paths, section: string, from: string, to: string, task?: string) {
  withLock(p, () => {
    const claims = readClaims(p);
    if (claims[section]?.agent !== from) throw new Error(`"${section}" is not owned by ${from}`);
    claims[section] = { agent: to, since: new Date().toISOString(), task };
    writeJson(p.claims, claims);
    log(p, from, "handoff", `${section} -> ${to}${task ? `: ${task}` : ""}`);
  });
}

export function addNote(p: Paths, target: NoteTarget, author: string, body: string): Note {
  return withLock(p, () => {
    const notes = readNotes(p);
    const id = `n${(notes.reduce((n, x) => Math.max(n, Number(x.id.slice(1)) || 0), 0) + 1).toString()}`;
    const note: Note = { id, target, author, body, status: "open", at: new Date().toISOString(), replies: [] };
    writeJson(p.notes, [...notes, note]);
    log(p, author, "note", `${id} on ${target.section}${target.frame != null ? ` f${target.frame}` : ""}: ${body}`);
    return note;
  });
}

export function replyNote(p: Paths, id: string, reply: Omit<NoteReply, "at">, resolve = false): Note {
  return withLock(p, () => {
    const notes = readNotes(p);
    const note = notes.find((n) => n.id === id);
    if (!note) throw new Error(`no note ${id}`);
    if (reply.body) note.replies.push({ ...reply, at: new Date().toISOString() });
    if (resolve) note.status = "resolved";
    writeJson(p.notes, notes);
    log(p, reply.author, resolve ? "resolve" : "reply", `${id}${reply.body ? `: ${reply.body}` : ""}`);
    return note;
  });
}

export function reopenNote(p: Paths, id: string, author: string) {
  withLock(p, () => {
    const notes = readNotes(p);
    const note = notes.find((n) => n.id === id);
    if (!note) throw new Error(`no note ${id}`);
    note.status = "open";
    writeJson(p.notes, notes);
    log(p, author, "reopen", id);
  });
}

export function listVersions(p: Paths): string[] {
  if (!fs.existsSync(p.versions)) return [];
  return fs.readdirSync(p.versions).filter((d) => !d.startsWith(".")).sort();
}

// Versions are forks: the current film/ is frozen read-only under .agenticeditor/versions/<version>, then the manifest
// moves to the next version. Old cuts are never edited.
export function fork(p: Paths, agent: string, next?: string): { frozen: string; next: string } {
  return withLock(p, () => {
    const m = readManifest(p);
    const dest = path.join(p.versions, m.version);
    if (fs.existsSync(dest)) throw new Error(`${m.version} is already frozen; bump film.json's version by hand if you meant to start over`);
    fs.mkdirSync(p.versions, { recursive: true });
    fs.cpSync(p.film, dest, { recursive: true });
    lockReadOnly(dest);
    const n = next ?? bump(m.version);
    writeManifest(p, { ...m, version: n });
    log(p, agent, "fork", `${m.version} frozen, now on ${n}`);
    return { frozen: m.version, next: n };
  });
}

function bump(v: string) {
  const match = v.match(/^(.*?)(\d+)$/);
  return match ? `${match[1]}${Number(match[2]) + 1}` : `${v}-2`;
}

function lockReadOnly(dir: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) lockReadOnly(f);
    else fs.chmodSync(f, 0o444);
  }
}
