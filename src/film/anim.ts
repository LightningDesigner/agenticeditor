// Frame-pure animation helpers. Motion's easings and mixers are pure functions, so they are safe here;
// its components and animate() run on timers and are not (a scrubbed or rendered frame would not match).
import { interpolate } from "remotion";
import { anticipate, backOut, circOut, cubicBezier, easeIn, easeInOut, easeOut, mix } from "motion";

export const ease = { in: easeIn, out: easeOut, inOut: easeInOut, back: backOut, circ: circOut, anticipate, bezier: cubicBezier };
export type Easing = (t: number) => number;

// value of a tween at `frame`: from a to b between frames f0..f1, clamped
export function tween(frame: number, [f0, f1]: [number, number], [a, b]: [number, number], easing: Easing = easeInOut) {
  return interpolate(frame, [f0, f1], [a, b], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// 0..1 progress between two frames, eased
export function progress(frame: number, f0: number, f1: number, easing: Easing = easeInOut) {
  return tween(frame, [f0, f1], [0, 1], easing);
}

// mix anything Motion can mix (numbers, colours, "10px 20px") by a 0..1 amount
export function blend<T extends string | number>(a: T, b: T, amount: number): T {
  return mix(a as never, b as never)(amount) as T;
}

// deterministic pseudo-random in [0,1) from a seed; Math.random() is banned in sections
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// a pulse that peaks on each beat and decays: 1 on the beat, ~0 by the next
export function pulse(frame: number, framesPerBeat: number, decay = 4) {
  const phase = (frame % framesPerBeat) / framesPerBeat;
  return Math.exp(-phase * decay);
}
