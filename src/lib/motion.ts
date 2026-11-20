"use client";

import { animate, createTimeline, stagger } from "animejs";

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The rubber stamp coming down on a form: overshoots in, then the sheet jolts. */
export function slamStamp(stamp: HTMLElement, sheet?: HTMLElement | null) {
  if (reducedMotion()) return;
  const tl = createTimeline();
  // The stamp's resting tilt comes from its CSS `rotate`; this only adds the extra swing on the way down.
  tl.add(stamp, { scale: [2.4, 1], opacity: [0, 1], rotate: [-10, 0], duration: 300, ease: "in(3)" });
  if (sheet) {
    tl.add(
      sheet,
      { y: [{ to: 3, duration: 50 }, { to: -1, duration: 90 }, { to: 0, duration: 140 }], ease: "out(2)" },
      "-=30",
    );
  }
  return tl;
}

/** Cards rising into place one after another. */
export function riseIn(targets: Element[] | NodeListOf<Element>, opts: { delay?: number; distance?: number } = {}) {
  const list = Array.from(targets);
  if (!list.length) return;
  if (reducedMotion()) {
    list.forEach((el) => ((el as HTMLElement).style.opacity = "1"));
    return;
  }
  return animate(list, {
    opacity: [0, 1],
    y: [opts.distance ?? 14, 0],
    delay: stagger(opts.delay ?? 40),
    duration: 520,
    ease: "out(3)",
  });
}

/** Counts a number up inside an element, e.g. a match score. */
export function countUp(el: HTMLElement, to: number, suffix = "") {
  if (reducedMotion()) {
    el.textContent = `${to}${suffix}`;
    return;
  }
  const state = { v: 0 };
  return animate(state, {
    v: to,
    duration: 900,
    ease: "out(4)",
    onUpdate: () => {
      el.textContent = `${Math.round(state.v)}${suffix}`;
    },
  });
}

export function slideStep(el: HTMLElement, direction: 1 | -1) {
  if (reducedMotion()) return;
  return animate(el, { opacity: [0, 1], x: [28 * direction, 0], duration: 420, ease: "out(3)" });
}
