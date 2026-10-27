// Stills, contact sheets and full renders through Remotion. This is how an agent looks at its own frames
// before a human does.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { PKG, generate } from "../core/codegen";
import { readManifest, type Paths } from "../core/state";
import { buildTimeline, resolveFrameRef, timecode } from "../core/timeline";

// Resolve from the package, not the film's project, so the film and the runtime share one React and one Remotion.
// Installed in a project, npm may hoist these next to the package rather than inside it; require.resolve finds either.
const requireFromPkg = createRequire(path.join(PKG, "package.json"));

export function aliases(): Record<string, string> {
  const nm = (name: string) => path.dirname(requireFromPkg.resolve(`${name}/package.json`));
  return {
    "agenticeditor": path.join(PKG, "src/film/index.ts"),
    react: nm("react"),
    "react-dom": nm("react-dom"),
    remotion: nm("remotion"),
  };
}

async function bundleFilm(p: Paths, onProgress?: (n: number) => void) {
  generate(p);
  return bundle({
    entryPoint: path.join(p.gen, "remotion-entry.tsx"),
    publicDir: p.film,
    outDir: path.join(p.dot, "bundle"),
    onProgress,
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias as object), ...aliases() } },
    }),
  });
}

export type Still = { ref: string; frame: number; file: string };

export async function stills(p: Paths, refs: string[], opts: { scale?: number; dir?: string } = {}): Promise<Still[]> {
  const m = readManifest(p);
  const tl = buildTimeline(m);
  const frames = refs.map((ref) => ({ ref, frame: Math.min(resolveFrameRef(tl, ref), tl.durationInFrames - 1) }));
  const serveUrl = await bundleFilm(p);
  const composition = await selectComposition({ serveUrl, id: "agenticeditor", inputProps: {} });
  const dir = opts.dir ?? path.join(p.frames, m.version);
  fs.mkdirSync(dir, { recursive: true });
  const out: Still[] = [];
  for (const f of frames) {
    const file = path.join(dir, `f${String(f.frame).padStart(5, "0")}.png`);
    await renderStill({ composition, serveUrl, output: file, frame: f.frame, scale: opts.scale ?? 1, inputProps: {} });
    out.push({ ...f, file });
  }
  return out;
}

// One still per beat (plus the section's first frame), tiled into a sheet: the zoomed-out view of a section.
export async function sheet(p: Paths, sectionId?: string): Promise<{ file: string; stills: Still[] }> {
  const m = readManifest(p);
  const tl = buildTimeline(m);
  const sections = sectionId ? tl.sections.filter((s) => s.id === sectionId) : tl.sections;
  if (!sections.length) throw new Error(`no section "${sectionId}"`);
  const refs = sections.flatMap((s) => [`f${s.from}`, ...s.beats.map((b) => `f${b.frame}`)]);
  const uniq = [...new Set(refs)];
  const name = `sheet-${sectionId ?? "all"}-${m.version}`;
  const dir = path.join(p.frames, m.version, name);
  fs.rmSync(dir, { recursive: true, force: true });
  const s = await stills(p, uniq, { scale: 0.4, dir });
  const file = path.join(p.frames, m.version, `${name}.png`);
  const cols = Math.min(4, s.length);
  const rows = Math.ceil(s.length / cols);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `tile=${cols}x${rows}:padding=8:color=white`, "-frames:v", "1", file]);
  return { file, stills: s };
}

export async function renderFilm(p: Paths, out?: string, onProgress?: (n: number) => void) {
  const m = readManifest(p);
  const serveUrl = await bundleFilm(p);
  const composition = await selectComposition({ serveUrl, id: "agenticeditor", inputProps: {} });
  const file = out ?? path.join(p.dot, "renders", `${m.id}-${m.version}.mp4`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: file, inputProps: {}, onProgress: ({ progress }) => onProgress?.(progress) });
  return file;
}

export function describeStill(p: Paths, s: Still) {
  const tl = buildTimeline(readManifest(p));
  return `${s.ref} -> f${s.frame} ${timecode(s.frame, tl.fps)}  ${path.relative(p.root, s.file)}`;
}
