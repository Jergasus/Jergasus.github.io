'use client';

import { useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { caseStudySlugs } from '@/content/projects';
import { getApp, isCaseApp, type AppId } from './apps';
import { useOsInternal } from './context';
import { recallWindow, rememberWindow, windowReopened } from './window-memory';

export type WindowLabels = { close: string; minimize: string; maximize: string; restore: string };

type Props = { id: AppId; title: string; children: ReactNode; labels: WindowLabels };

/** Each project window sits this far below and right of the one before it, so a covered one still shows its title bar. */
const CASCADE_PX = 28;
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const percent = (fraction: number) => `${Number((fraction * 100).toFixed(3))}%`;

/**
 * A window: a labelled section with a title bar and three buttons. Its state
 * (open, minimised, maximised, focused, stacking) comes from the shell's
 * reducer and is published as data attributes; os.css lays it out from them
 * and from --x/--y/--w/--h. With no saved rect those are the app's default
 * rect as percentages of the desktop, so the server HTML is already placed.
 */
export function WindowFrame({ id, title, children, labels }: Props) {
  const { state, dispatch, focusApp, closeApp, minimizeApp } = useOsInternal();
  const win = state.windows[id];
  const app = getApp(id)!;
  const section = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // A press on close or minimise must not first bring the window forward.
  const keepBehind = useRef(false);

  const step = isCaseApp(id) ? caseStudySlugs.indexOf(id) * CASCADE_PX : 0;
  const { x, y, w, h } = app.defaultRect;
  const style = {
    '--x': win.rect ? `${win.rect.x}px` : `calc(${percent(x)} + ${step}px)`,
    '--y': win.rect ? `${win.rect.y}px` : `calc(${percent(y)} + ${step}px)`,
    '--w': win.rect ? `${win.rect.w}px` : percent(w),
    '--h': win.rect ? `${win.rect.h}px` : percent(h),
    '--z': String(win.z),
    '--app': `var(--os-c-${app.colour})`,
  } as CSSProperties;

  useLayoutEffect(() => {
    if (win.open) windowReopened(id);
  }, [id, win.open]);

  // Read by the effect below as it mounts (this one runs first).
  const inFront = useRef(false);
  useLayoutEffect(() => {
    inFront.current = state.focused === id;
  });

  // A project window remounts when the URL moves (window-memory.ts): give it
  // back its scroll position, and keyboard focus if it is the window in
  // front (one that went behind, by back or forward, does not take it).
  useLayoutEffect(() => {
    const frame = section.current!;
    const scroller = body.current!;
    const memory = recallWindow(id);
    if (memory) {
      scroller.scrollTop = memory.scroll;
      const active = document.activeElement;
      if (memory.focus !== null && inFront.current && (!active || active === document.body)) {
        const target =
          memory.focus === -1 ? frame : frame.querySelectorAll<HTMLElement>(FOCUSABLE)[memory.focus];
        target?.focus({ preventScroll: true });
      }
    }
    return () => {
      // Still attached here: React removes the DOM after this cleanup.
      const active = document.activeElement;
      const focus =
        active === frame
          ? -1
          : active && frame.contains(active)
            ? [...frame.querySelectorAll(FOCUSABLE)].indexOf(active)
            : null;
      rememberWindow(id, { scroll: scroller.scrollTop, focus });
    };
  }, [id]);

  const onPointerDown = (event: PointerEvent) => {
    keepBehind.current = (event.target as Element).closest('[data-win-close], [data-win-minimize]') !== null;
    if (!keepBehind.current) focusApp(id);
  };

  // Keyboard focus landing in a window brings it forward, so focus is never
  // hidden behind another window.
  const onFocus = () => {
    if (keepBehind.current) {
      keepBehind.current = false;
      return;
    }
    focusApp(id);
  };

  return (
    <section
      ref={section}
      id={id}
      data-app={id}
      data-win-state={!win.open ? 'closed' : win.minimized ? 'minimized' : 'open'}
      data-focused={String(state.focused === id)}
      data-maximized={String(win.maximized)}
      data-phone-active={String(state.phoneActive === id)}
      data-interactive-only={app.interactiveOnly ? '' : undefined}
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      className="os-win"
      style={style}
      onPointerDown={onPointerDown}
      onPointerUp={() => {
        keepBehind.current = false;
      }}
      onFocus={onFocus}
    >
      <div data-titlebar className="os-titlebar">
        <span id={`${id}-title`} className="os-title">
          {title}
        </span>
        <span className="os-grip" aria-hidden="true" />
        <span className="os-win-buttons">
          <button
            type="button"
            data-win-minimize
            aria-label={labels.minimize}
            className="os-win-button"
            onClick={() => minimizeApp(id)}
          >
            <Glyph kind="minimize" />
          </button>
          <button
            type="button"
            data-win-maximize
            aria-label={win.maximized ? labels.restore : labels.maximize}
            className="os-win-button"
            onClick={() => dispatch({ type: 'toggleMaximize', id })}
          >
            <Glyph kind={win.maximized ? 'restore' : 'maximize'} />
          </button>
          <button
            type="button"
            data-win-close
            aria-label={labels.close}
            className="os-win-button"
            onClick={() => closeApp(id)}
          >
            <Glyph kind="close" />
          </button>
        </span>
      </div>
      {/* Focusable so a keyboard can scroll a window with nothing to tab to. */}
      <div ref={body} className="os-win-body" tabIndex={0}>
        {children}
      </div>
    </section>
  );
}

// 12 x 12 pixel glyphs, drawn on whole pixels so they stay crisp.
const GLYPHS = {
  minimize: 'M2 8h8v2H2z',
  maximize: 'M2 2h8v8H2zM4 5v3h4V5z',
  restore: 'M4 1h7v7H9V3H4zM1 4h7v7H1zM3 6v3h3V6z',
  close: 'M2 2h2v1h1v1h2V3h1V2h2v2H9v1H8v2h1v1h1v2H8V9H7V8H5v1H4v1H2V8h1V7h1V5H3V4H2z',
} as const;

function Glyph({ kind }: { kind: keyof typeof GLYPHS }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d={GLYPHS[kind]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
