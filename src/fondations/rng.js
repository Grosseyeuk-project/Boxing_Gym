// RNG déterministe (mulberry32) pour que les captures soient reproductibles.
let s = 0x9e3779b9;
export function seed(n) { s = n >>> 0; }
export function rand() {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randRange = (a, b) => a + (b - a) * rand();
