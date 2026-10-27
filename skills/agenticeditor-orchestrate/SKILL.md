---
name: agenticeditor-orchestrate
description: Run several agents on one agenticeditor film at once — one agent per section, coordinated through claims, handoffs and the shared log. Use when the user asks to build or rebuild a whole film, "fan out", "parallelise", have "five agents rebuild five sections", or when there are open notes across several sections.
---

# Several agents, one film

Sections own their beats, so they can be built in parallel: one agent per section, handing off by id.
The coordination is the CLI, not chat: claims are locked, notes and the log are shared and live in the editor.

## As the orchestrator

1. `agenticeditor status --json`. Make a plan: which sections need work and why (intent, open notes, missing component).
2. **Fork first** if the change is big: `agenticeditor fork`. The human can compare against the frozen version.
3. Settle **shared structure yourself, before fanning out**: section order, `bars`, beat ids, `fps`, size, BPM.
   Those live in film.json and change every section's timing; workers must not change them.
4. Spawn one worker per section. Each brief carries: its agent id (`AE_AGENT=<id>`), the section id, the
   intent, the open note ids, and the rule "only edit film/sections/<id>.tsx and your section's entry in
   film.json; load the agenticeditor and agenticeditor-section skills". Workers claim their section as their first action.
5. Watch `agenticeditor log` and `agenticeditor status`. A worker that needs another section's change asks for it in a note on that
   section (`agenticeditor note --at <section> "…"`), not by editing it.
6. When workers finish: `agenticeditor check`, then `agenticeditor sheet` for the whole film. Look at the joins between sections
   (each section's last beat against the next one's first frame); that's where parallel work breaks.
7. Report with the sheet, the notes resolved, and anything left open.

## As a worker

Load `agenticeditor` and `agenticeditor-section`. Claim your section (`agenticeditor claim <id> --agent <your id> --task "…"`). Stay inside it.
Hand it on explicitly when another agent should continue: `agenticeditor handoff <id> <next-agent> --task "…"`. Release it
when done.

## Conflicts

- Claim refused: someone owns it. Don't work around the lock.
- Two sections need the same beat moved: that's shared structure; it goes back to the orchestrator.
- film.json is the one shared file: re-read it right before editing your entry, and edit only that entry.
