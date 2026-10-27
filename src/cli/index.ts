// The agent's interface to the editor. Every command works on <root> (default: cwd) and prints plain text,
// or JSON with --json, so an agent can read it back.
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { PKG, generate } from "../core/codegen";
import { check } from "../core/check";
import { addNote, claim, fork, handoff, listVersions, log, paths, readClaims, readLog, readManifest, readNotes, release, replyNote, type Note } from "../core/state";
import { buildTimeline, frameRef, resolveFrameRef, sectionAt, timecode } from "../core/timeline";

const program = new Command("agenticeditor").description("A video editor agents drive. Films are code; sections are owned; notes are pinned to frames.");
program.option("-r, --root <dir>", "project root (holds film/ and .agenticeditor/)", process.cwd()).option("--json", "machine-readable output");

const P = () => paths(program.opts().root);
const asJson = () => Boolean(program.opts().json);
const agentOf = (o: { agent?: string }) => o.agent ?? process.env.AE_AGENT ?? "agent";
const print = (text: string, data?: unknown) => console.log(asJson() ? JSON.stringify(data ?? text, null, 2) : text);

program
  .command("init")
  .description("scaffold film/ and install the agenticeditor skills into this project (.claude/skills and .agents/skills)")
  .option("--id <id>", "film id", "film")
  .option("--no-skills", "don't install skills")
  .action((o) => {
    const p = P();
    if (fs.existsSync(p.manifest)) console.log(`film/film.json already exists; leaving it`);
    else {
      fs.cpSync(path.join(PKG, "templates/film"), p.film, { recursive: true });
      const m = JSON.parse(fs.readFileSync(p.manifest, "utf8"));
      fs.writeFileSync(p.manifest, JSON.stringify({ ...m, id: o.id, title: o.id }, null, 2) + "\n");
      console.log(`created film/ (film.json + sections/)`);
    }
    if (o.skills) {
      for (const dest of [".claude/skills", ".agents/skills"]) {
        for (const skill of fs.readdirSync(path.join(PKG, "skills"))) {
          fs.cpSync(path.join(PKG, "skills", skill), path.join(p.root, dest, skill), { recursive: true });
        }
      }
      console.log(`installed skills: ${fs.readdirSync(path.join(PKG, "skills")).join(", ")}`);
    }
    const gi = path.join(p.root, ".gitignore");
    const ignore = ["/.agenticeditor/gen/", "/.agenticeditor/bundle/", "/.agenticeditor/frames/", "/.agenticeditor/renders/", "/.agenticeditor/lock"];
    const have = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
    const add = ignore.filter((l) => !have.includes(l));
    if (add.length) fs.appendFileSync(gi, `${have && !have.endsWith("\n") ? "\n" : ""}# agenticeditor: generated and rendered files\n${add.join("\n")}\n`);
    generate(p);
    console.log(`next: agenticeditor dev   (editor)   ·   agenticeditor status   ·   agenticeditor check`);
  });

program
  .command("dev")
  .description("open the editor on localhost")
  .option("-p, --port <n>", "port", "4780")
  .action(async (o) => {
    const { dev } = await import("../server/dev");
    const server = await dev(program.opts().root, Number(o.port));
    console.log(`agenticeditor editor: ${server.resolvedUrls?.local[0] ?? `http://localhost:${o.port}/`}`);
  });

program
  .command("status")
  .description("the film at a glance: sections, frames, owners, open notes")
  .action(() => {
    const p = P();
    const m = readManifest(p);
    const tl = buildTimeline(m);
    const claims = readClaims(p);
    const notes = readNotes(p).filter((n) => n.status === "open");
    const rows = tl.sections.map((s) => ({
      id: s.id,
      from: s.from,
      frames: s.durationInFrames,
      at: timecode(s.from, tl.fps),
      bars: m.sections[s.index].bars,
      beats: s.beats.map((b) => b.id),
      owner: claims[s.id]?.agent ?? null,
      task: claims[s.id]?.task ?? null,
      openNotes: notes.filter((n) => n.target.section === s.id).map((n) => n.id),
      intent: m.sections[s.index].intent ?? null,
    }));
    const data = { id: m.id, version: m.version, fps: m.fps, size: [m.width, m.height], bpm: m.bpm, frames: tl.durationInFrames, versions: listVersions(p), sections: rows };
    const lines = [
      `${m.title} (${m.id} ${m.version}) · ${m.width}×${m.height} · ${m.fps}fps · ${m.bpm}bpm · ${tl.durationInFrames}f ${timecode(tl.durationInFrames, tl.fps)}`,
      ...rows.map(
        (r) =>
          `  ${r.id.padEnd(14)} ${r.at}  ${String(r.frames).padStart(4)}f  ${r.bars} bars  owner: ${(r.owner ?? "—").padEnd(10)} notes: ${r.openNotes.join(",") || "—"}  beats: ${r.beats.join(" ") || "—"}`,
      ),
      listVersions(p).length ? `  frozen: ${listVersions(p).join(" ")}` : "",
    ].filter(Boolean);
    print(lines.join("\n"), data);
  });

program
  .command("claim <section>")
  .description("own a section before editing it; fails if another agent owns it")
  .option("-a, --agent <id>", "your agent id (or $AE_AGENT)")
  .option("-t, --task <text>", "what you're doing, shown in the editor")
  .action((section, o) => {
    const c = claim(P(), section, agentOf(o), o.task);
    print(`${section} owned by ${c.agent}`, c);
  });

program
  .command("release <section>")
  .option("-a, --agent <id>")
  .option("--force", "release someone else's claim (humans only)")
  .action((section, o) => {
    release(P(), section, agentOf(o), o.force);
    print(`${section} released`);
  });

program
  .command("handoff <section> <to>")
  .description("pass a section you own to another agent, with a task")
  .option("-a, --agent <id>")
  .option("-t, --task <text>")
  .action((section, to, o) => {
    handoff(P(), section, agentOf(o), to, o.task);
    print(`${section} -> ${to}`);
  });

program
  .command("notes")
  .description("list review notes (open by default)")
  .option("--all", "include resolved")
  .option("-s, --section <id>")
  .option("--mine", "only notes on sections you own")
  .option("-a, --agent <id>")
  .action((o) => {
    const p = P();
    const claims = readClaims(p);
    const mine = new Set(Object.entries(claims).filter(([, c]) => c.agent === agentOf(o)).map(([s]) => s));
    const notes = readNotes(p).filter((n) => (o.all || n.status === "open") && (!o.section || n.target.section === o.section) && (!o.mine || mine.has(n.target.section)));
    print(notes.map(fmtNote).join("\n\n") || "no notes", notes);
  });

program
  .command("note <body...>")
  .description("pin a note to a frame, beat or section")
  .requiredOption("--at <ref>", "frame (f120), seconds (4s), section id or section.beat")
  .option("-a, --agent <id>")
  .action((bodyWords: string[], o) => {
    const p = P();
    const tl = buildTimeline(readManifest(p));
    const frame = resolveFrameRef(tl, o.at);
    const s = sectionAt(tl, frame);
    const beat = [...s.beats].reverse().find((b) => b.frame <= frame);
    const n = addNote(p, { section: s.id, beat: beat?.id, frame }, agentOf(o), bodyWords.join(" "));
    print(fmtNote(n), n);
  });

program
  .command("reply <id> [body...]")
  .description("answer a note; attach a render of the frame with --render, close it with --resolve")
  .option("-a, --agent <id>")
  .option("--render", "render the note's frame and attach it")
  .option("--resolve")
  .action(async (id: string, bodyWords: string[], o) => {
    const p = P();
    const note = readNotes(p).find((n) => n.id === id);
    if (!note) throw new Error(`no note ${id}`);
    let render: string | undefined;
    if (o.render) {
      const { stills } = await import("../server/render");
      const [s] = await stills(p, [note.target.frame != null ? `f${note.target.frame}` : note.target.beat ? `${note.target.section}.${note.target.beat}` : note.target.section]);
      render = path.relative(p.root, s.file);
    }
    const n = replyNote(p, id, { author: agentOf(o), body: bodyWords.join(" "), render }, o.resolve);
    print(fmtNote(n), n);
  });

program
  .command("frame <refs...>")
  .description("render exact frames to PNG so you can look at them (f120, 4s, section, section.beat)")
  .option("--scale <n>", "0.25–1", "1")
  .action(async (refs: string[], o) => {
    const p = P();
    const { stills, describeStill } = await import("../server/render");
    const s = await stills(p, refs, { scale: Number(o.scale) });
    log(p, process.env.AE_AGENT ?? "agent", "frame", s.map((x) => `f${x.frame}`).join(" "));
    print(s.map((x) => describeStill(p, x)).join("\n"), s);
  });

program
  .command("sheet [section]")
  .description("contact sheet: the first frame and every beat of a section (or the film), tiled into one PNG")
  .action(async (section?: string) => {
    const p = P();
    const { sheet } = await import("../server/render");
    const r = await sheet(p, section);
    print(`${path.relative(p.root, r.file)}  (${r.stills.length} frames: ${r.stills.map((s) => s.ref).join(" ")})`, r);
  });

program
  .command("render [out]")
  .description("render the whole film to mp4")
  .action(async (out?: string) => {
    const p = P();
    const { renderFilm } = await import("../server/render");
    let last = -1;
    const file = await renderFilm(p, out, (n) => {
      const pct = Math.floor(n * 10) * 10;
      if (pct !== last && !asJson()) process.stderr.write(`${pct}% `), (last = pct);
    });
    log(p, process.env.AE_AGENT ?? "agent", "render", path.relative(p.root, file));
    print(`\n${path.relative(p.root, file)}`, { file });
  });

program
  .command("fork [next]")
  .description("freeze the current version read-only under .agenticeditor/versions and move to the next")
  .option("-a, --agent <id>")
  .action((next: string | undefined, o) => {
    const r = fork(P(), agentOf(o), next);
    print(`froze ${r.frozen}; now on ${r.next}`, r);
  });

program
  .command("check")
  .description("validate film.json, beats, section files and determinism. Run before reporting any change done.")
  .action(() => {
    const p = P();
    generate(p);
    const f = check(p);
    const errors = f.filter((x) => x.level === "error");
    print(f.map((x) => `${x.level === "error" ? "✗" : "!"} ${x.where}: ${x.message}`).join("\n") || "✓ clean", f);
    if (errors.length) process.exitCode = 1;
  });

program
  .command("ref <frame>")
  .description("the copyable reference for a frame, e.g. to quote in a note")
  .action((ref: string) => {
    const p = P();
    const m = readManifest(p);
    const tl = buildTimeline(m);
    print(frameRef(m, tl, resolveFrameRef(tl, ref)));
  });

program
  .command("log")
  .description("recent activity from every agent and human")
  .option("-n <count>", "entries", "30")
  .action((o) => {
    const l = readLog(P(), Number(o.n));
    print(l.map((e) => `${e.at.slice(11, 19)}  ${e.agent.padEnd(10)} ${e.action.padEnd(8)} ${e.detail ?? ""}`).join("\n") || "no activity", l);
  });

function fmtNote(n: Note) {
  const where = [n.target.section, n.target.beat, n.target.frame != null ? `f${n.target.frame}` : null].filter(Boolean).join(" · ");
  const head = `${n.id} [${n.status}] ${where} — ${n.author}: ${n.body}`;
  return [head, ...n.replies.map((r) => `    ↳ ${r.author}: ${r.body}${r.render ? ` [${r.render}]` : ""}`)].join("\n");
}

program.parseAsync().catch((e) => {
  console.error(`agenticeditor: ${(e as Error).message}`);
  process.exit(1);
});
