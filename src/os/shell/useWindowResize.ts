'use client';

import { useRef, type Dispatch, type PointerEvent, type RefObject } from 'react';
import type { AppId } from '../apps';
import type { WmAction } from '../window-manager';
import { desktopBounds } from './desktopBounds';
import { beginWindowGesture, endWindowGesture } from './windowGesture';

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type ResizeState = {
  pointerId: number;
  dir: ResizeDir;
  startX: number;
  startY: number;
  orig: { x: number; y: number; w: number; h: number };
  /** Most recent delta from onPointerMove — used for the synchronous final apply on pointerup. */
  lastDx?: number;
  lastDy?: number;
};

type Options = {
  id: AppId;
  sectionRef: RefObject<HTMLElement | null>;
  dispatch: Dispatch<WmAction>;
  minSize: { w: number; h: number };
};

function computeRect(
  orig: { x: number; y: number; w: number; h: number },
  dir: ResizeDir,
  dx: number,
  dy: number,
  min: { w: number; h: number },
) {
  let { x, y, w, h } = orig;

  if (dir.includes('n')) {
    y = orig.y + dy;
    h = orig.h - dy;
  }
  if (dir.includes('s')) {
    h = orig.h + dy;
  }
  if (dir.includes('e')) {
    w = orig.w + dx;
  }
  if (dir.includes('w')) {
    x = orig.x + dx;
    w = orig.w - dx;
  }

  // Enforce minimum sizes.
  if (w < min.w) {
    if (dir.includes('w')) x = orig.x + orig.w - min.w;
    w = min.w;
  }
  if (h < min.h) {
    if (dir.includes('n')) y = orig.y + orig.h - min.h;
    h = min.h;
  }

  return { x, y, w, h };
}

/**
 * Pointer-event resize for the 8 edge/corner handles.
 *
 * During the drag the window size is reflected by updating the CSS override vars
 * `--rx/--ry/--rw/--rh` directly on the section element (no React re-render per
 * frame). On pointer up the final rect is committed with `setRect` and the vars
 * are cleared.
 */
export function useWindowResize({ id, sectionRef, dispatch, minSize }: Options) {
  const resize = useRef<ResizeState | null>(null);
  const rafId = useRef<number | null>(null);

  function onHandlePointerDown(dir: ResizeDir, e: PointerEvent<HTMLElement>) {
    // Skip when not in desktop OS mode.
    if (document.documentElement.getAttribute('data-os') !== 'desktop') return;

    const section = sectionRef.current;
    if (!section) return;

    const box = section.getBoundingClientRect();
    resize.current = {
      pointerId: e.pointerId,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: box.left, y: box.top, w: box.width, h: box.height },
    };
    // Capture so the section receives move/up even when the pointer leaves.
    section.setPointerCapture(e.pointerId);
    beginWindowGesture();
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const rs = resize.current;
    if (!rs || rs.pointerId !== e.pointerId) return;
    const section = sectionRef.current;
    if (!section) return;

    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;
    // Store for the synchronous final apply on pointerup/cancel.
    rs.lastDx = dx;
    rs.lastDy = dy;

    // Coalesce CSS var writes into one rAF so we write at most once per frame.
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const rs2 = resize.current;
      const sec = sectionRef.current;
      if (!rs2 || !sec) return;
      const { x, y, w, h } = computeRect(rs2.orig, rs2.dir, rs2.lastDx ?? 0, rs2.lastDy ?? 0, minSize);
      // Write to override vars — React controls --x/--y/--w/--h and never touches these.
      sec.style.setProperty('--rx', `${x}px`);
      sec.style.setProperty('--ry', `${y}px`);
      sec.style.setProperty('--rw', `${w}px`);
      sec.style.setProperty('--rh', `${h}px`);
    });
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const rs = resize.current;
    if (!rs || rs.pointerId !== e.pointerId) return;
    endWindowGesture();

    // Cancel any pending rAF before reading the final state.
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    const section = sectionRef.current;
    if (!section) return;

    // Clear override vars before dispatching so React's reconcile wins.
    section.style.removeProperty('--rx');
    section.style.removeProperty('--ry');
    section.style.removeProperty('--rw');
    section.style.removeProperty('--rh');

    // Use stored deltas (from the last pointermove) for the final rect.
    const dx = rs.lastDx ?? (e.clientX - rs.startX);
    const dy = rs.lastDy ?? (e.clientY - rs.startY);
    resize.current = null;

    if (dx === 0 && dy === 0) return;

    const rect = computeRect(rs.orig, rs.dir, dx, dy, minSize);
    dispatch({ type: 'setRect', id, rect, bounds: desktopBounds() });
  }

  function onPointerCancel(e: PointerEvent<HTMLElement>) {
    const rs = resize.current;
    if (!rs || rs.pointerId !== e.pointerId) return;
    endWindowGesture();

    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }

    const section = sectionRef.current;
    if (!section) return;
    section.style.removeProperty('--rx');
    section.style.removeProperty('--ry');
    section.style.removeProperty('--rw');
    section.style.removeProperty('--rh');
    resize.current = null;
  }

  return { onHandlePointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
