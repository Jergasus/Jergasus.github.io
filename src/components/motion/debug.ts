import type { gsap as Gsap } from 'gsap';

/**
 * E2E-only view of the motion layer (ruling R4). Builds with
 * NEXT_PUBLIC_E2E=1 (the Playwright webServer) expose it as
 * window.__motionDebug for e2e/os-motion.spec.ts. The deploy build never sets
 * the variable, so the call in gsap.ts is dead code there and is dropped.
 */
export type MotionDebug = {
  /** Every property GSAP has tweened since the page loaded, hidden states included. */
  properties: () => string[];
  /** The sequences that have run in this document, in order. */
  played: string[];
  /** Slows down (or speeds up) every tween, so a test can act mid-animation. */
  timeScale: (scale: number) => void;
};

declare global {
  interface Window {
    __motionDebug?: MotionDebug;
  }
}

// GSAP's own config keys (gsap-core.js `_reservedProps`): timing, callbacks
// and plumbing, never properties of the target.
const CALLBACKS = ['onComplete', 'onUpdate', 'onStart', 'onRepeat', 'onReverseComplete', 'onInterrupt'];
const RESERVED = new Set([
  ...CALLBACKS,
  ...CALLBACKS.map((name) => `${name}Params`),
  'parent',
  'duration',
  'ease',
  'delay',
  'overwrite',
  'runBackwards',
  'startAt',
  'yoyo',
  'immediateRender',
  'repeat',
  'repeatDelay',
  'data',
  'paused',
  'reversed',
  'lazy',
  'callbackScope',
  'stringFilter',
  'id',
  'yoyoEase',
  'stagger',
  'inherit',
  'repeatRefresh',
  'keyframes',
  'autoRevert',
  'scrollTrigger',
  'easeReverse',
]);

/** The target properties a tween's vars change, from-values (`startAt`) included. */
export function tweenedProperties(vars: object): string[] {
  const own = Object.keys(vars).filter((key) => !RESERVED.has(key));
  const from = (vars as { startAt?: unknown }).startAt;
  return from && typeof from === 'object' ? [...own, ...tweenedProperties(from)] : own;
}

export function installMotionDebug(gsap: typeof Gsap) {
  const seen = new Set<string>();
  window.__motionDebug = {
    properties: () => [...seen].sort(),
    played: [],
    timeScale: (scale) => {
      gsap.globalTimeline.timeScale(scale);
    },
  };
  // Finished tweens leave GSAP's global timeline, so look on every tick
  // while they are still there (paused, scroll-triggered ones stay).
  gsap.ticker.add(() => {
    for (const tween of gsap.globalTimeline.getChildren(true, true, false)) {
      for (const name of tweenedProperties(tween.vars)) seen.add(name);
    }
  });
}

/** Notes that a sequence ran (dropped from builds without the recorder). */
export function recordPlayed(sequence: string) {
  if (process.env.NEXT_PUBLIC_E2E === '1') window.__motionDebug?.played.push(sequence);
}
