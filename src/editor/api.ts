import { useEffect, useState } from "react";
import type { Manifest } from "../core/manifest";
import type { Claim, LogEntry, Note, NoteTarget } from "../core/state";
import type { Finding } from "../core/check";

export type ReelState = {
  manifest: Manifest | null;
  error: string | null;
  claims: Record<string, Claim>;
  notes: Note[];
  log: LogEntry[];
  versions: string[];
  findings: Finding[];
};

// Live state: refetched whenever anything under .agenticeditor/ or film.json changes (an agent claimed, replied, edited).
export function useReelState() {
  const [state, setState] = useState<ReelState | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const load = () =>
      fetch("/api/state")
        .then((r) => r.json())
        .then(setState)
        .catch(() => {});
    load();
    const es = new EventSource("/api/events");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = load;
    return () => es.close();
  }, []);
  return { state, live };
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export const api = {
  addNote: (target: NoteTarget, body: string, author: string) => post("/api/notes", { target, body, author }),
  reply: (id: string, body: string, author: string) => post(`/api/notes/${id}/reply`, { body, author }),
  resolve: (id: string, author: string) => post(`/api/notes/${id}/resolve`, { author }),
  reopen: (id: string, author: string) => post(`/api/notes/${id}/reopen`, { author }),
};

export function getAuthor() {
  try {
    return localStorage.getItem("agenticeditor.author") || "human";
  } catch {
    return "human";
  }
}

export function setAuthor(name: string) {
  try {
    localStorage.setItem("agenticeditor.author", name);
  } catch {
    /* private window: the name just won't persist */
  }
}
