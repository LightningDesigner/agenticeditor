# Agentic Editor

A video editor that agents drive. Films are code (React + Remotion), laid out on a BPM grid of sections and
named beats. Each section is owned by one agent at a time, so several agents can build one film in parallel.
Humans review in a local editor by pinning notes to exact frames. Agents answer with renders of those frames,
and they look at their own frames before anyone else does.

## Install

Run this once in the project you want to make a video in:

```sh
npm i -D agenticeditor && npx agenticeditor init
```

That's it. It adds `film/` (the film's plan and one file per section) and installs the agent skills. Open the
editor with `npx agenticeditor dev`; it prints the localhost link.

## Give it to an agent

Paste this to Claude Code, Codex or any coding agent working in your project:

> Install the agenticeditor npm package in this project and set it up: run
> `npm i -D agenticeditor && npx agenticeditor init`. Then load the `agenticeditor` skill it installed and
> follow it for all video work: write the film's sections in `film/film.json`, build each section in
> `film/sections/`, run `npx agenticeditor check` after every change, and look at your own frames with
> `npx agenticeditor frame <section>` before telling me it's done. Start the editor with
> `npx agenticeditor dev` and give me the link.

After `init`, an agent opening the project finds the skills on its own, so later sessions need no instructions.

Modelled on how the Paper Mono launch film was made
([thread](https://x.com/agusegui/status/2108251509830140401)): sections own their beats, reviews are comments
pinned to frames, versions are forks, and every change is checked.

## The skills

`init` installs four skills into `.claude/skills` and `.agents/skills`:

| Skill | For |
|---|---|
| `agenticeditor` | The loop every change follows: status → claim → edit → check → look at frames → reply → release |
| `agenticeditor-section` | Writing a section: frame-pure React, beats, Motion easings, porting a design's exact values |
| `agenticeditor-notes` | Working through notes pinned in the editor, answering with a render |
| `agenticeditor-orchestrate` | One agent per section, handoffs by id, checking the joins |

## Working on this package itself

    npm install
    npm run dev                                      # editor on the example film
    npm run agenticeditor -- --root example status
    npm run agenticeditor -- --root example frame grid.drop   # renders .agenticeditor/frames/v1/f00360.png

## Layout of a film

    film/film.json            the manifest: fps, size, bpm, sections (bars, beats, intent, props)
    film/sections/<id>.tsx    one React component per section, default export
    .agenticeditor/claims.json         who owns which section          ┐
    .agenticeditor/notes.json          notes pinned to frames          │ shared state, written only through the CLI
    .agenticeditor/log.jsonl           every claim, note, reply, render │ (locked, so agents can run at once)
    .agenticeditor/versions/<v>/       frozen, read-only forks         ┘
    .agenticeditor/frames/ renders/    stills and renders (gitignored)

## CLI

| Command | |
|---|---|
| `agenticeditor status` | sections, timecodes, owners, open notes |
| `agenticeditor claim <section> --task "…"` / `release` / `handoff <section> <agent>` | ownership |
| `agenticeditor notes [--mine] [--section id] [--all]` | review notes |
| `agenticeditor note --at <ref> "…"` | pin a note from the CLI |
| `agenticeditor reply <id> "…" [--render] [--resolve]` | answer; `--render` attaches the note's frame |
| `agenticeditor frame <refs…>` / `agenticeditor sheet [section]` | exact stills / a contact sheet of every beat |
| `agenticeditor check` | schema, beats, missing components, determinism lint |
| `agenticeditor fork [next]` | freeze this version, move to the next |
| `agenticeditor render [out.mp4]` | the whole film |
| `agenticeditor ref <ref>` / `agenticeditor log` | copyable frame reference / activity |

`ae` is a short alias for `agenticeditor`. Frame refs everywhere: `f120`, `4.5s`, `grid` (section start), `grid.drop` (a beat). `--json` on any command;
`AE_AGENT=<id>` names you in claims and the log.

## Editor keys

`Space` play · `←` `→` frame (`⇧` ×10) · `[` `]` previous / next beat · `H` hold (loop) the current section ·
`N` pin a note on the canvas · `C` copy the frame reference · `Esc` cancel.

## Stack

React 19, TypeScript, Remotion 4 (`@remotion/player` in the editor, `@remotion/renderer` for stills and renders),
Motion (easings and mixers only; its timer-driven components break determinism), Vite (the editor), zod, commander,
chokidar. The CLI runs TypeScript through tsx; there's no build step yet.


## Known gaps (draft)

- Installed under `node_modules`, the package's TypeScript sources may need a build step for Remotion's
  bundler; so far it's only been run from this repo and a sibling project.
- Each `agenticeditor frame`/`sheet` call re-bundles (about 5–10 s). A long-lived render server would make it instant.
- No audio waveform or stems lane yet (the thread's Strudel/BPM panel). `audio` in film.json plays but isn't drawn.
- No side-by-side A/B against frozen versions in the editor yet.
- Paper/Figma MCP is a convention in the skills, not an integration.
- Ownership is enforced for claims, not for file writes. Agents follow the skills; nothing stops a rogue edit.
