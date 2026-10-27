---
name: agenticeditor
description: Work on a film made with agenticeditor (the agent-driven video editor). Use whenever a project has film/film.json or .agenticeditor/, or the user asks to make, edit, retime, review or render a video, launch film, motion piece or section of one. Covers the loop every change follows (status → claim → edit → check → look at your frames → reply), the rules that keep frames deterministic, and which other agenticeditor skill to load next.
---

# agenticeditor

A film is code. `film/film.json` lists sections on a BPM grid; each section is a React component in
`film/sections/<id>.tsx` that draws frame *t* as a pure function of *t*. Humans review in the editor
(`agenticeditor dev`) by pinning notes to frames. Agents do everything through the `agenticeditor` CLI.

Run it as `npx agenticeditor …` (or `node node_modules/agenticeditor/bin/agenticeditor.mjs …`). Set `AE_AGENT=<your id>` once so
claims, notes and the log carry your name. Add `--json` to any command to read its output as data.

## The loop (every change, no exceptions)

1. **Orient.** `agenticeditor status` (sections, frames, owners, open notes) and `agenticeditor notes --mine`.
2. **Claim before you touch.** `agenticeditor claim <section> --task "<what you're doing>"`. If it fails, someone owns it:
   don't edit it; ask them or the human for a `agenticeditor handoff`. You may only edit files of sections you own.
   `film.json` is shared: change only *your* section's entry, and keep edits small (others are reading it).
3. **Read the intent.** The section's `intent` in film.json is the brief. Notes on the section are the review.
4. **Edit.** See the `agenticeditor-section` skill for how sections are written.
5. **Check.** `agenticeditor check` must print `✓ clean`. Errors are not optional; fix them.
6. **Look at your own frames before anyone else does.** `agenticeditor frame <section>.<beat> …` or `agenticeditor sheet <section>`,
   then open the PNGs and judge them against the intent and the notes. Not "it compiles": does the frame say the
   thing? Is text cut off, unreadable, off-beat? Fix and look again.
7. **Answer.** For each note you addressed: `agenticeditor reply <id> "<what changed>" --render --resolve`. `--render`
   attaches the exact frame the note was pinned to, so the human sees the fix without scrubbing.
8. **Release** when you're done with the section: `agenticeditor release <section>`.

## Naming frames

Everyone names frames the same way: `f120` (frame), `4.5s` (seconds), `grid` (a section's first frame),
`grid.drop` (a beat). `agenticeditor ref <frame>` prints the full reference (`hello-agenticeditor v1 · f360 · 00:12:00 · grid ·
grid.drop`) for quoting in notes. Prefer beats over raw frames: they survive retiming.

## Versions

`agenticeditor fork` freezes the current film read-only under `.agenticeditor/versions/<version>` and moves to the next version.
Fork before a big change the human may want to compare against. Never edit anything under `.agenticeditor/versions/`.

## Which skill next

- Writing or changing a section's code: **agenticeditor-section**.
- Working through review notes: **agenticeditor-notes**.
- Splitting a film across several agents: **agenticeditor-orchestrate**.

## Never

- Edit a section you haven't claimed, or files under `.agenticeditor/` by hand (use the CLI; it locks).
- Report a change done without `agenticeditor check` passing and without having looked at the frames.
- Fake what a section shows. If the intent can't be met honestly, say so in a reply instead.
