// `agenticeditor check`: what every change must pass before an agent reports it done.
import fs from "node:fs";
import path from "node:path";
import { ManifestSchema } from "./manifest";
import { buildTimeline } from "./timeline";
import { readClaims, readNotes, type Paths } from "./state";

export type Finding = { level: "error" | "warn"; where: string; message: string };

// Things that make a frame depend on something other than t. A scrubbed frame must equal the rendered one.
const NONDETERMINISM: [RegExp, string][] = [
  [/Math\.random\s*\(/, "Math.random(): use rand(seed) from agenticeditor"],
  [/Date\.now\s*\(|new Date\s*\(\s*\)|performance\.now\s*\(/, "wall-clock time: derive everything from the frame"],
  [/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/, "timers: derive everything from the frame"],
  [/from\s+["'](motion\/react|framer-motion)["']/, "Motion components animate on timers: use tween()/ease from agenticeditor (Motion's pure easings)"],
  [/\banimate\s*\(/, "animate() runs on a timer: use tween()"],
  [/\buseEffect\s*\(/, "useEffect in a section usually means state that the frame doesn't drive; check it's not animating"],
];

export function check(p: Paths): Finding[] {
  const out: Finding[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(p.manifest, "utf8"));
  } catch (e) {
    return [{ level: "error", where: "film/film.json", message: `not readable JSON: ${(e as Error).message}` }];
  }
  const parsed = ManifestSchema.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) out.push({ level: "error", where: `film.json ${i.path.join(".")}`, message: i.message });
    return out;
  }
  const m = parsed.data;
  const tl = buildTimeline(m);

  const ids = new Set<string>();
  for (const s of m.sections) {
    if (ids.has(s.id)) out.push({ level: "error", where: `section ${s.id}`, message: "duplicate section id" });
    ids.add(s.id);
    const beatIds = new Set<string>();
    for (const b of s.beats) {
      if (beatIds.has(b.id)) out.push({ level: "error", where: `${s.id}.${b.id}`, message: "duplicate beat id in section" });
      beatIds.add(b.id);
      if (b.bar + b.beat / m.beatsPerBar >= s.bars) out.push({ level: "error", where: `${s.id}.${b.id}`, message: `beat at bar ${b.bar} beat ${b.beat} is past the section's ${s.bars} bars` });
      if (b.beat >= m.beatsPerBar) out.push({ level: "warn", where: `${s.id}.${b.id}`, message: `beat ${b.beat} ≥ beatsPerBar ${m.beatsPerBar}; use the next bar instead` });
    }
    const comp = s.component ?? s.id;
    const file = ["tsx", "jsx", "ts"].map((e) => path.join(p.sections, `${comp}.${e}`)).find((f) => fs.existsSync(f));
    if (!file) {
      out.push({ level: "warn", where: `section ${s.id}`, message: `no component at film/sections/${comp}.tsx (renders a placeholder)` });
      continue;
    }
    const src = fs.readFileSync(file, "utf8");
    src.split("\n").forEach((line, i) => {
      if (/^\s*\/\//.test(line) || /ae-allow/.test(line)) return;
      for (const [re, msg] of NONDETERMINISM) {
        if (re.test(line)) out.push({ level: msg.startsWith("useEffect") ? "warn" : "error", where: `${path.relative(p.root, file)}:${i + 1}`, message: msg });
      }
    });
    for (const m2 of src.matchAll(/(?:beat|since)\(\s*["']([^"']+)["']\s*\)/g)) {
      if (!beatIds.has(m2[1])) out.push({ level: "error", where: `${path.relative(p.root, file)}`, message: `uses beat "${m2[1]}", which section ${s.id} doesn't define` });
    }
  }

  const claims = readClaims(p);
  for (const sec of Object.keys(claims)) if (!ids.has(sec)) out.push({ level: "warn", where: `.agenticeditor/claims.json`, message: `claim on unknown section "${sec}"` });
  for (const n of readNotes(p)) {
    if (n.status === "open" && !ids.has(n.target.section)) out.push({ level: "warn", where: `note ${n.id}`, message: `pinned to unknown section "${n.target.section}"` });
    if (n.status === "open" && n.target.frame != null && n.target.frame >= tl.durationInFrames) out.push({ level: "warn", where: `note ${n.id}`, message: `pinned past the end of the film` });
  }
  if (m.audio && !fs.existsSync(path.join(p.film, m.audio))) out.push({ level: "error", where: "film.json audio", message: `film/${m.audio} not found` });
  return out;
}
