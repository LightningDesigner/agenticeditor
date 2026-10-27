---
name: agenticeditor-section
description: How to write or change one section of a agenticeditor film — a React + Remotion component that draws a frame as a pure function of the frame number, timed to named beats on the BPM grid. Use when creating a section, animating something in one, syncing motion to music ("on the drop"), adding beats, or porting a design (Paper, Figma) into a section.
---

# Writing a agenticeditor section

Load the `agenticeditor` skill first for the claim → check → look loop. This is how the code itself is written.

## Shape

```tsx
// film/sections/grid.tsx: default export, file name = section id (or the section's "component")
import React from "react";
import { AbsoluteFill } from "remotion";
import { useSection, tween, progress, blend, pulse, rand, ease } from "agenticeditor";

export default function Grid({ title = "hello" }: { title?: string }) {   // props come from film.json "props"
  const s = useSection();
  const y = tween(s.since("drop"), [0, s.framesPerBeat], [40, 0], ease.out);
  return <AbsoluteFill style={{ transform: `translateY(${y}px)` }}>{title}</AbsoluteFill>;
}
```

`useSection()` gives local time: `frame` (0 at the section's start), `progress` (0–1), `fps`, `framesPerBeat`,
`framesPerBar`, `bar` / `beatIndex` (fractional musical position), `beat(id)` (the local frame of a named beat),
`since(id)` (frames since that beat; negative before it) and `props`.

## Time comes from beats, not numbers

Motion is anchored to **named beats** in film.json, not to frame literals. "The invert hits on the drop" is
`since("drop")`. Add a beat when you need a new anchor:

```json
{ "id": "drop", "label": "the drop", "bar": 2, "beat": 0 }
```

`bar`/`beat` are 0-based inside the section. Durations should be multiples of `framesPerBeat` so motion stays
on the grid. `agenticeditor check` fails if you reference a beat the section doesn't define.

## Determinism (checked)

A frame must be the same whether it's scrubbed, stepped backwards, or rendered on another machine. So:

| Don't | Do |
|---|---|
| `Math.random()` | `rand(seed)`: seed from index and beat, e.g. `rand(i + beatNo * 97)` |
| `Date.now()`, timers, `requestAnimationFrame` | derive from `s.frame` |
| `motion/react` components, `animate()` | `tween()` / `progress()` with Motion's easings (`ease.out`, `ease.back`, `ease.bezier(…)`) |
| CSS transitions/animations | compute the value per frame |
| state that accumulates over frames | a closed-form function of the frame |

`blend(a, b, amount)` mixes numbers or colours (`blend("#fff", "#35f", t)`). `pulse(frame, framesPerBeat)` gives a
1→0 decay on every beat for things that breathe with the music. Use Remotion's `<Img>`, `<OffthreadVideo>`,
`staticFile()` for assets (files live under `film/`), and `delayRender` only for loading, never for timing.
If a line genuinely needs one of the flagged APIs, append `// ae-allow` with a reason.

## Porting a design

When the section's intent links a design (a Paper or Figma frame), read it through that tool's MCP and port the
**exact values** (positions, sizes, colours, type) scaled to the film's size from film.json. Don't eyeball a
screenshot. Note the source frame in the component's top comment.

## Done means

`agenticeditor check` is clean **and** you've opened `agenticeditor sheet <section>` and the frames at every beat you touched.
