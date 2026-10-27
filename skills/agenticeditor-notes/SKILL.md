---
name: agenticeditor-notes
description: Work through review notes on a agenticeditor film — notes humans pin to exact frames in the agenticeditor editor. Use when the user says "check the notes", "address the feedback", "I left comments", or names a note id (n12), and whenever `agenticeditor status` shows open notes on a section you own.
---

# Review notes

Humans review by pressing **N** in the editor and clicking the canvas: each note is pinned to a frame, a point
on that frame (`x`, `y`, 0–1), the section and the latest beat. Agents answer with a render.

## Loop

1. `agenticeditor notes --mine --json` (or `--section <id>`, or all open notes). Read `target`: section, beat, frame, x, y.
2. **Look before you change anything.** `agenticeditor frame f<frame>` and open the PNG. Find what's at (`x`, `y`)
   (x 0.5, y 0.2 is top centre). Understand what the note is pointing at *in the picture*, not just its words.
3. Claim the section if you don't own it (`agenticeditor claim`). If someone else owns it and won't hand off, reply on the
   note saying who has it; don't edit.
4. Make the change (see `agenticeditor-section`). Keep it to what the note asks; if it implies a bigger change, reply with
   the question instead of guessing.
5. `agenticeditor check`, then look at the same frame again, plus its neighbours (`agenticeditor frame f<frame-15> f<frame>
   f<frame+15>`): fixes often break the frames around them.
6. `agenticeditor reply <id> "<what changed, in one line>" --render --resolve`. Without `--resolve` if you want the human
   to confirm, or when you only partly addressed it.

## Reading notes well

- A note is a symptom at a frame. "Feels late" at the drop usually means the motion should start *on* the beat,
  i.e. `since("drop")` with no lead-in ease, not that the beat should move.
- Several notes on one section: read them all before changing anything; they often have one cause.
- Resolved notes are history. Don't reopen them; leave a new note if something regressed.
- Never resolve a note you didn't address, and never answer without a render when the note is about how
  something looks.
