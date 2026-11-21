'use client';

import { useRef, type Dispatch, type PointerEvent, type RefObject } from 'react';
import type { AppId } from '../apps';
import type { WmAction } from '../window-manager';
import { desktopBounds } from './desktopBounds';
import { beginWindowGesture, endWindowGesture } from './windowGesture';

/**
 * The titlebar buttons that act on their own. A press on one of them never
 * drags or maximises. The move handle (`[data-win-move]`) is a button too, but
 * it fills the empty part of the titlebar, where people grab a window, so it
 * is deliberately not in this list.
 */
export const WINDOW_CONTROLS = '[data-win-close], [data-win-minimize], [data-win-maximize], [data-phone-back]';

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
  origW: number;
  origH: number;
};

type Options = {
  id: AppId;
  sectionRef: RefObject<HTMLElement | null>;
  dispatch: Dispatch<WmAction>;
};

/**
 * Pointer-event drag via the titlebar.
 *
 * During the drag the window moves by applying a CSS `transform` only —
 * no layout properties are animated. On pointer up the final position is
 * committed with a `setRect` dispatch and the transform is cleared.
 *
 * On phone or when no desktop element exists the drag is a no-op so accidental
 * touch-drag on mobile is harmless.
 */
export function useWindowDrag({ id, sectionRef, dispatch }: Options) {
  const drag = useRef<DragState | null>(null);

  function onTitlebarPointerDown(e: PointerEvent<HTMLElement>) {
    // Skip when not in desktop OS mode.
    if (document.documentElement.getAttribute('data-os') !== 'desktop') return;
    // Window controls handle their own events; don't start a drag on them.
    if ((e.target as Element).closest(WINDOW_CONTROLS)) return;
    // (A double click never gets here: WindowFrame maximises on the second
    // press, timed itself, and starts no drag.)

    const section = sectionRef.current;
    if (!section) return;

    const box = section.getBoundingClientRect();
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: box.left,
      origTop: box.top,
      origW: box.width,
      origH: box.height,
    };
    section.setPointerCapture(e.pointerId);
    beginWindowGesture();
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const section = sectionRef.current;
    if (!section) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    section.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function onPointerUp(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endWindowGesture();
    const section = sectionRef.current;
    if (!section) return;

    drag.current = null;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (dx === 0 && dy === 0) {
      section.style.transform = '';
      return;
    }

    const newX = d.origLeft + dx;
    const newY = d.origTop + dy;

    // Commit the new position: update CSS vars directly so the frame does not
    // snap back for one render frame before React reconciles the new state.
    section.style.setProperty('--x', `${newX}px`);
    section.style.setProperty('--y', `${newY}px`);
    section.style.transform = '';

    dispatch({
      type: 'setRect',
      id,
      rect: { x: newX, y: newY, w: d.origW, h: d.origH },
      bounds: desktopBounds(),
    });
  }

  function onPointerCancel(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endWindowGesture();
    const section = sectionRef.current;
    if (!section) return;
    section.style.transform = '';
    drag.current = null;
  }

  return { onTitlebarPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}
