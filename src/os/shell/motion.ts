import { gsap } from '@/components/motion/gsap';
import { recordPlayed } from '@/components/motion/debug';
import { motion } from '@/design/motion';
import type { AppId } from '../apps';

/**
 * JG-OS motion sequences (spec §6.4), timed by motion.os (src/design/motion.ts).
 *
 * Every sequence follows the same rules:
 * - The window manager's state commits first. A sequence only draws on top of
 *   it, so tests and assistive technology see the final state at once.
 * - Only transform and opacity animate. The open/close outline is its own
 *   element, positioned once in [data-motion-layer] and then only transformed.
 * - One sequence per app at a time. A new action on the app, its window
 *   leaving the page or a phone/desktop switch finishes the running one: its
 *   elements jump to their final look at once. An animation never blocks
 *   input and never leaves anything hidden.
 * - Callers skip all of it when useMotionSafe().enabled is false: reduced
 *   motion means instant state changes.
 */

export type Box = { left: number; top: number; width: number; height: number };
type Mode = 'desktop' | 'phone';

/** The on-screen box of an element that is laid out, or null. */
export function boxOf(element: Element | null | undefined): Box | null {
  if (!(element instanceof HTMLElement) || !element.isConnected) return null;
  const { left, top, width, height } = element.getBoundingClientRect();
  return width > 0 && height > 0 ? { left, top, width, height } : null;
}

const query = (selector: string) => document.querySelector<HTMLElement>(selector);

function firstBox(...elements: (HTMLElement | null | undefined)[]): Box | null {
  for (const element of elements) {
    const box = boxOf(element);
    if (box) return box;
  }
  return null;
}

/**
 * The home-screen element that represents an app on the phone.
 * Lookup chain:
 *   1. [data-phone-icon=id] — a direct home grid icon
 *   2. [data-phone-home] [data-open-app=id] — a guide button in the phone home
 */
export function phoneHomeTarget(id: AppId): HTMLElement | null {
  const q = (s: string) => document.querySelector<HTMLElement>(s);
  return q(`[data-phone-icon="${id}"]`) ?? q(`[data-phone-home] [data-open-app="${id}"]`);
}

/** Where a window grows from: what opened it, else its taskbar button or its icon. */
export function openOrigin(id: AppId, mode: Mode, opener?: HTMLElement | null): Box | null {
  return mode === 'phone'
    ? firstBox(opener, phoneHomeTarget(id))
    : firstBox(opener, query(`[data-task="${id}"]`), query(`[data-icon="${id}"]`));
}

/** Where a closed window shrinks back to: what opened it, else its icon. */
export function closeTarget(id: AppId, mode: Mode, opener?: HTMLElement | null): Box | null {
  return firstBox(opener, mode === 'phone' ? phoneHomeTarget(id) : query(`[data-icon="${id}"]`));
}

// ── Geometry ────────────────────────────────────────────────────────────────

const IDENTITY = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

/** The transform (origin top left) that lays something drawn at `frame` over `box`. */
function fit(frame: Box, box: Box) {
  return {
    x: box.left - frame.left,
    y: box.top - frame.top,
    scaleX: box.width / frame.width,
    scaleY: box.height / frame.height,
  };
}

/** Share of the window an outline grows from (or shrinks to) when nothing opened it. */
const MIDDLE = 0.2;

function middleOf(box: Box): Box {
  const width = box.width * MIDDLE;
  const height = box.height * MIDDLE;
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}

// ── Running sequences ───────────────────────────────────────────────────────

type Sequence = { target: HTMLElement | null; finish: (andThen: boolean) => void };
const running = new Map<AppId, Sequence>();

/**
 * Jumps the app's running sequence to its final look, then runs what was
 * waiting for it (a phone project's trip home). With `target`, only a
 * sequence that holds that element (a window leaving the page keeps its
 * close outline running).
 */
export function finishMotion(id: AppId, target?: HTMLElement) {
  const sequence = running.get(id);
  if (sequence && (!target || sequence.target === target)) sequence.finish(true);
}

/**
 * Like finishMotion, but drops what was waiting for the sequence: the visitor
 * asked for the app again, and their last intent wins.
 */
export function cancelMotion(id: AppId) {
  running.get(id)?.finish(false);
}

/** Finishes every running sequence (the OS switches between desktop and phone). */
export function finishAllMotion() {
  for (const sequence of [...running.values()]) sequence.finish(true);
}

/**
 * A timeline for `id` whose end (played out or finished early) runs `settle`,
 * then `then` unless the sequence was cancelled.
 */
function sequence(id: AppId, target: HTMLElement | null, settle: () => void, then?: () => void) {
  let done = false;
  const finish = (andThen: boolean) => {
    if (done) return;
    done = true;
    timeline.kill();
    settle();
    if (running.get(id)?.finish === finish) running.delete(id);
    if (andThen) then?.();
  };
  const timeline = gsap.timeline({ onComplete: () => finish(true) });
  running.set(id, { target, finish });
  return timeline;
}

// ── The outline ─────────────────────────────────────────────────────────────
// Four dashed edges laid out once over the window's box. Each edge only moves
// and stretches along its own length, so the line stays 2 px wide at every
// size (scaling one bordered box would thin the line to nothing near an icon).

const EDGES = ['top', 'right', 'bottom', 'left'] as const;
type Edge = (typeof EDGES)[number];
type Outline = { element: HTMLElement; edges: Record<Edge, HTMLElement> };

function outline(box: Box, kind: 'open' | 'close'): Outline {
  const element = document.createElement('div');
  element.className = 'os-motion-outline';
  element.setAttribute('data-motion-outline', kind);
  element.setAttribute('aria-hidden', 'true');
  element.style.cssText = `left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`;
  const edges = {} as Record<Edge, HTMLElement>;
  for (const edge of EDGES) {
    edges[edge] = document.createElement('div');
    edges[edge].className = 'os-motion-edge';
    edges[edge].setAttribute('data-edge', edge);
    element.append(edges[edge]);
  }
  (query('[data-motion-layer]') ?? document.body).append(element);
  return { element, edges };
}

/** Each edge's transform for an outline laid out at `frame` and drawn at `box`. */
function edgesAt(frame: Box, box: Box): Record<Edge, typeof IDENTITY> {
  const { x, y, scaleX, scaleY } = fit(frame, box);
  return {
    top: { x, y, scaleX, scaleY: 1 },
    bottom: { x, y: y + box.height - frame.height, scaleX, scaleY: 1 },
    left: { x, y, scaleX: 1, scaleY },
    right: { x: x + box.width - frame.width, y, scaleX: 1, scaleY },
  };
}

/** Adds the outline's trip from `from` to `to` (it is laid out at `frame`) to a timeline. */
function trace(
  timeline: ReturnType<typeof gsap.timeline>,
  line: Outline,
  frame: Box,
  from: Box,
  to: Box,
  timing: { duration: number; ease: string },
) {
  const start = edgesAt(frame, from);
  const end = edgesAt(frame, to);
  for (const edge of EDGES) {
    timeline.fromTo(line.edges[edge], start[edge], { ...end[edge], ...timing, immediateRender: true }, 0);
  }
  return timeline;
}

/** Hands a window back to the stylesheet: no transform, no opacity, usable. */
function release(frame: HTMLElement) {
  frame.removeAttribute('data-motion');
  frame.inert = false;
  // Keep GSAP's cached transform in step, then drop the inline styles.
  gsap.set(frame, { ...IDENTITY, opacity: 1 });
  frame.style.removeProperty('transform');
  frame.style.removeProperty('opacity');
}

// ── Opening ─────────────────────────────────────────────────────────────────

/** How long an open the visitor asked for may wait for its window (a project waits for its route). */
const OPEN_WAIT_MS = 2000;
const asked = new Map<AppId, { from: Box | null; at: number }>();

/** The visitor asked to open `id`: its window animates in when it next appears. */
export function expectOpen(id: AppId, from: Box | null) {
  asked.set(id, { from, at: performance.now() });
}

/** The open asked for `id`, if any (taken once). Windows nobody asked for appear as they are. */
export function takeOpen(id: AppId): { from: Box | null } | null {
  const ask = asked.get(id);
  asked.delete(id);
  return ask && performance.now() - ask.at < OPEN_WAIT_MS ? ask : null;
}

/** Desktop: a dashed outline grows from `from` to the window, then the window appears. */
export function playOpen(id: AppId, frame: HTMLElement, from: Box | null) {
  finishMotion(id);
  const to = boxOf(frame);
  if (!to) return;
  const line = outline(to, 'open');
  frame.setAttribute('data-motion', 'in');
  const timeline = sequence(id, frame, () => {
    line.element.remove();
    release(frame);
  }).set(frame, { opacity: 0, immediateRender: true }, 0);
  trace(timeline, line, to, from ?? middleOf(to), to, motion.os.open).set(frame, { opacity: 1 });
  recordPlayed('os-open');
}

/** Phone: the app grows out of its icon to full screen. */
export function playPhoneOpen(id: AppId, frame: HTMLElement, from: Box | null) {
  finishMotion(id);
  const to = boxOf(frame);
  if (!to) return;
  frame.setAttribute('data-motion', 'in');
  sequence(id, frame, () => release(frame)).fromTo(
    frame,
    { ...fit(to, from ?? middleOf(to)), opacity: 0 },
    { ...IDENTITY, opacity: 1, ...motion.os.phoneApp, immediateRender: true },
  );
  recordPlayed('os-phone-open');
}

// ── Closing and minimising ──────────────────────────────────────────────────

/** Desktop: the window is already gone; an outline of it shrinks back to its opener or icon. */
export function playClose(id: AppId, from: Box, to: Box | null) {
  finishMotion(id);
  const line = outline(from, 'close');
  trace(sequence(id, null, () => line.element.remove()), line, from, from, to ?? middleOf(from), motion.os.close);
  recordPlayed('os-close');
}

/**
 * Phone: the app closes back into its icon. Its state has already left the
 * front (home shows underneath); data-motion="out" keeps it drawn, inert,
 * until it lands. `then` runs when it ends, or at once when nothing can play:
 * a project app's trip home waits for it, since the route unmounts the frame.
 */
export function playPhoneClose(id: AppId, frame: HTMLElement, to: Box | null, then?: () => void) {
  finishMotion(id);
  const from = boxOf(frame);
  if (!from) {
    then?.();
    return;
  }
  frame.setAttribute('data-motion', 'out');
  frame.inert = true;
  sequence(id, frame, () => release(frame), then).fromTo(
    frame,
    { ...IDENTITY, opacity: 1 },
    { ...fit(from, to ?? middleOf(from)), opacity: 0, ...motion.os.phoneClose, immediateRender: true },
  );
  recordPlayed('os-phone-close');
}

/**
 * Desktop: the window scales into its taskbar button. Its state is already
 * minimised; data-motion="out" keeps it drawn (inert) until it lands.
 */
export function playMinimize(id: AppId, frame: HTMLElement, to: Box | null) {
  finishMotion(id);
  const from = boxOf(frame);
  if (!from || !to) return;
  frame.setAttribute('data-motion', 'out');
  frame.inert = true;
  sequence(id, frame, () => release(frame)).fromTo(
    frame,
    { ...IDENTITY, opacity: 1 },
    { ...fit(from, to), opacity: 0, ...motion.os.minimize, immediateRender: true },
  );
  recordPlayed('os-minimize');
}

// ── Toasts ──────────────────────────────────────────────────────────────────

/** How far a toast travels: from its place to just past the right edge. */
const offscreen = (box: Box) => window.innerWidth - box.left;

function settleToast(element: HTMLElement) {
  gsap.set(element, { x: 0 });
  element.style.removeProperty('transform');
}

/** A toast slides in from the right edge of the screen. */
export function playToastIn(element: HTMLElement) {
  const box = boxOf(element);
  if (!box) return;
  gsap.fromTo(
    element,
    { x: offscreen(box) },
    { x: 0, ...motion.os.toast, immediateRender: true, onComplete: () => settleToast(element) },
  );
  recordPlayed('os-toast');
}

/** A dismissed toast leaves the way it came (from wherever it is), then `done` removes it. */
export function playToastOut(element: HTMLElement, done: () => void) {
  const box = boxOf(element);
  if (!box) {
    done();
    return;
  }
  element.inert = true;
  gsap.to(element, { x: `+=${offscreen(box)}`, ...motion.os.close, overwrite: true, onComplete: done });
}
