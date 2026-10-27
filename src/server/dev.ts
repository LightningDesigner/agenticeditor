// `agenticeditor dev`: the editor on localhost. Vite serves the React editor; a small API reads and writes the same
// .agenticeditor/ state the CLI uses, and pushes every change (an agent claiming, replying, editing film.json) to the page.
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import chokidar from "chokidar";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin } from "vite";
import { PKG, generate } from "../core/codegen";
import { check } from "../core/check";
import { addNote, listVersions, paths, readClaims, readLog, readManifest, readNotes, reopenNote, replyNote, type Paths } from "../core/state";
import { aliases } from "./render";

export async function dev(root: string, port = 4780) {
  const p = paths(root);
  generate(p);
  const server = await createServer({
    configFile: false,
    root: path.join(PKG, "src/editor"),
    plugins: [react(), api(p)],
    resolve: {
      alias: { ...aliases(), "@ae-gen": path.join(p.gen, "film.gen.ts") },
      dedupe: ["react", "react-dom", "remotion"],
    },
    server: { port, host: "localhost", strictPort: true, fs: { allow: [PKG, p.root] } },
    logLevel: "warn",
  });
  await server.listen();
  return server;
}

function api(p: Paths): Plugin {
  const clients = new Set<ServerResponse>();
  const broadcast = () => {
    for (const c of clients) c.write(`data: ${Date.now()}\n\n`);
  };
  return {
    name: "agenticeditor-api",
    configureServer(server) {
      const watcher = chokidar.watch([p.manifest, p.claims, p.notes, p.log, p.versions], { ignoreInitial: true, depth: 0 });
      watcher.on("all", (_evt, file) => {
        if (file === p.manifest) {
          try {
            generate(p);
          } catch {
            /* invalid JSON mid-edit: the state endpoint reports it */
          }
        }
        broadcast();
      });
      server.httpServer?.on("close", () => watcher.close());

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? "/", "http://x");
        try {
          if (url.pathname === "/api/events") {
            res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
            res.write(": hi\n\n");
            clients.add(res);
            req.on("close", () => clients.delete(res));
            return;
          }
          if (url.pathname === "/api/state" && req.method === "GET") return json(res, state(p));
          if (url.pathname === "/api/notes" && req.method === "POST") {
            const b = await body(req);
            return json(res, addNote(p, b.target, String(b.author || "human"), String(b.body)));
          }
          const m = url.pathname.match(/^\/api\/notes\/(n\d+)\/(reply|resolve|reopen)$/);
          if (m && req.method === "POST") {
            const b = await body(req);
            const author = String(b.author || "human");
            if (m[2] === "reopen") {
              reopenNote(p, m[1], author);
              return json(res, { ok: true });
            }
            return json(res, replyNote(p, m[1], { author, body: String(b.body ?? "") }, m[2] === "resolve"));
          }
          // renders and stills that agents attach to note replies, and the film's own assets (audio)
          if (url.pathname.startsWith("/files/")) {
            const rel = decodeURIComponent(url.pathname.slice("/files/".length));
            const file = path.resolve(p.root, rel);
            const allowed = [p.film, p.frames, path.join(p.dot, "renders")].some((d) => file.startsWith(d + path.sep));
            if (!allowed || !fs.existsSync(file)) return res.writeHead(404).end();
            const type = { ".png": "image/png", ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav" }[path.extname(file)];
            res.writeHead(200, { "content-type": type ?? "application/octet-stream" });
            return fs.createReadStream(file).pipe(res);
          }
        } catch (e) {
          return json(res, { error: (e as Error).message }, 400);
        }
        next();
      });
    },
  };
}

function state(p: Paths) {
  let manifest = null;
  let error: string | null = null;
  try {
    manifest = readManifest(p);
  } catch (e) {
    error = (e as Error).message;
  }
  return {
    manifest,
    error,
    claims: readClaims(p),
    notes: readNotes(p),
    log: readLog(p, 80),
    versions: listVersions(p),
    findings: manifest ? check(p) : [],
  };
}

function json(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}

function body(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try {
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}
