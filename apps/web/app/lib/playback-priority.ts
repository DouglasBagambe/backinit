"use client";
let until = 0;
/** Keep newly visible display ads out of the stream's first connection window. */
export function prioritizePlayback() {
  until = Date.now() + 5000;
  performance.mark("backinit:play-request");
}
export function adStartDelay() {
  return Math.max(0, until - Date.now());
}
