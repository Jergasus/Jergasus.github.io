'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';
import { useMotionSafe } from '@/components/motion/useMotionSafe';
import { caseStudySlugs } from '@/content/projects';
import { getApp, isCaseApp, type AppId } from './apps';
import { useOsInternal } from './context';
import { APP_ICONS } from './icons';
import { WINDOW_GLYPHS } from './window-glyphs';
import { recallWindow, rememberWindow, windowReopened } from './window-memory';
import { useWindowDrag } from './shell/useWindowDrag';
import { useWindowResize, type ResizeDir } from './shell/useWindowResize';
import { desktopBounds } from './shell/desktopBounds';
import { finishMotion, playOpen, playPhoneOpen, takeOpen } from './shell/motion';

export type WindowLabels = { close: string; minimize: string; maximize: string; restore: string };

type Props = { id: AppId; title: string; children: ReactNode; labels: WindowLabels; phoneBackLabel?: string };

/** Each project window sits this far below and right of the one before it. */
const CASCADE_PX = 28;
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]';
const percent = (fraction: number) => `${Number((fraction * 100).toFixed(3))}%`;

const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/**
 * A window: a labelled section with a title bar and three buttons. Its state
 * (open, minimised, maximised, focused, stacking) comes from the shell's
 * reducer and is published as data attributes; os.css lays it out from them
 * and from --x/--y/--w/--h. With no saved rect those are the app's default
 * rect as percentages of the desktop, so the server HTML is already placed.
 */
export function WindowFrame({ id, title, children, labels, phoneBackLabel }: Props) {
  const { state, dispatch, mode, focusApp, closeApp, minimizeApp, phoneBack } = useOsInternal();
  const t = useTranslations('os.window');
  const tPhone = useTranslations('os.phone');
  const win = state.windows[id];
  const app = getApp(id)!;
  const Icon = APP_ICONS[id];
  const section = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  // A press on close or minimise must not first bring the window forward.
  const keepBehind = useRef(false);
  const animate = useMotionSafe().enabled;

  const step = isCaseApp(id) ? caseStudySlugs.indexOf(id) * CASCADE_PX : 0;
  const { x, y, w, h } = app.defaultRect;
  const style = {
    // A window that has not moved yet starts clear of the desktop icons.
    '--x': win.rect ? `${win.rect.x}px` : `max(var(--os-win-min-x, 0px), calc(${percent(x)} + ${step}px))`,
    '--y': win.rect ? `${win.rect.y}px` : `calc(${percent(y)} + ${step}px)`,
    '--w': win.rect ? `${win.rect.w}px` : percent(w),
    '--h': win.rect ? `${win.rect.h}px` : percent(h),
    '--z': String(win.z),
    '--app': `var(--os-c-${app.colour})`,
  } as CSSProperties;

  // ── Drag ──────────────────────────────────────────────────────────────────
  const { onTitlebarPointerDown, onPointerMove: onDragMove, onPointerUp: onDragUp, onPointerCancel: onDragCancel } =
    useWindowDrag({ id, sectionRef: section, dispatch });

  // ── Resize ────────────────────────────────────────────────────────────────
  const {
    onHandlePointerDown,
    onPointerMove: onResizeMove,
    onPointerUp: onResizeUp,
    onPointerCancel: onResizeCancel,
  } = useWindowResize({ id, sectionRef: section, dispatch, minSize: app.minSize });

  // ── Body scrollability — fix WCAG tab stop (carried item 3) ──────────────
  // The body is focusable in OS mode only when it overflows (so keyboard
  // scrolling works) and has an accessible name via aria-labelledby.
  const [scrollable, setScrollable] = useState(false);
  useLayoutEffect(() => {
    const b = body.current;
    if (!b) return;
    const check = () => setScrollable(b.scrollHeight > b.clientHeight || b.scrollWidth > b.clientWidth);
    check();
    const obs = new ResizeObserver(check);
    obs.observe(b);
    return () => obs.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (win.open) windowReopened(id);
  }, [id, win.open]);

  // ── Motion ────────────────────────────────────────────────────────────────
  // The reducer has already made the window show; when the visitor asked for
  // it (OsRoot's openApp), it animates in on top, before the first paint.
  // Windows on the first paint, restored from the session or brought back by
  // the browser's history were not asked for, so they simply show.
  const shows = win.open && (mode === 'phone' ? state.phoneActive === id : mode === 'desktop' && !win.minimized);
  const showed = useRef(false);
  useLayoutEffect(() => {
    const appeared = shows && !showed.current;
    showed.current = shows;
    if (!appeared) return;
    const ask = takeOpen(id);
    if (!ask || !animate) return;
    if (mode === 'phone') playPhoneOpen(id, section.current!, ask.from);
    else playOpen(id, section.current!, ask.from);
  }, [id, shows, mode, animate]);

  // A window leaving the page (a route change) takes its sequence with it.
  useLayoutEffect(() => {
    const frame = section.current!;
    return () => finishMotion(id, frame);
  }, [id]);

  // Read by the effect below as it mounts (this one runs first).
  const inFront = useRef(false);
  useLayoutEffect(() => {
    inFront.current = state.focused === id;
  });

  // A project window remounts when the URL moves: restore scroll and focus.
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

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    // Using a window that is still animating in shows it as it is, at once.
    finishMotion(id);
    keepBehind.current = (event.target as Element).closest('[data-win-close], [data-win-minimize]') !== null;
    if (!keepBehind.current) focusApp(id);
  };

  // Merge drag and resize pointermove/up/cancel.
  const onSectionPointerMove = (e: PointerEvent<HTMLElement>) => {
    onDragMove(e);
    onResizeMove(e);
  };
  const onSectionPointerUp = (e: PointerEvent<HTMLElement>) => {
    onDragUp(e);
    onResizeUp(e);
  };
  const onSectionPointerCancel = (e: PointerEvent<HTMLElement>) => {
    onDragCancel(e);
    onResizeCancel(e);
  };

  // Keyboard focus landing in a window brings it forward.
  const onFocus = () => {
    if (keepBehind.current) {
      keepBehind.current = false;
      return;
    }
    focusApp(id);
  };

  // ── Titlebar pointer handler (single click = drag, double click = maximise) ─
  // We cannot rely on `e.detail` because Playwright's synthetic pointer events
  // always send detail=0. Track inter-click time manually instead.
  const lastTitlePdTime = useRef(0);
  const handleTitlebarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button')) return;
    const now = Date.now();
    if (now - lastTitlePdTime.current < 500) {
      // Double-click: toggle maximise, do not start a drag.
      lastTitlePdTime.current = 0;
      dispatch({ type: 'toggleMaximize', id });
      return;
    }
    lastTitlePdTime.current = now;
    // Dragging a maximised window is a no-op; double-click (above) still works.
    if (!win.maximized) onTitlebarPointerDown(e);
  };

  // ── Keyboard move / resize (via the move handle button) ───────────────────
  const handleMoveKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!ARROWS.includes(e.key)) return;
    // No-op when maximised — arrows would snap a maximised window out of its full-screen position.
    if (win.maximized) return;
    e.preventDefault();

    const delta = e.shiftKey ? 64 : 16;
    const frame = section.current!;
    const box = frame.getBoundingClientRect();
    const bounds = desktopBounds();
    let { left: bx, top: by, width: bw, height: bh } = box;

    if (e.altKey) {
      // Alt + Arrow: resize.
      if (e.key === 'ArrowRight') bw += delta;
      if (e.key === 'ArrowLeft') bw = Math.max(app.minSize.w, bw - delta);
      if (e.key === 'ArrowDown') bh += delta;
      if (e.key === 'ArrowUp') bh = Math.max(app.minSize.h, bh - delta);
    } else {
      // Arrow: move.
      if (e.key === 'ArrowRight') bx += delta;
      if (e.key === 'ArrowLeft') bx -= delta;
      if (e.key === 'ArrowDown') by += delta;
      if (e.key === 'ArrowUp') by -= delta;
    }

    dispatch({ type: 'setRect', id, rect: { x: bx, y: by, w: bw, h: bh }, bounds });
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
      onPointerMove={onSectionPointerMove}
      onPointerUp={(e) => {
        keepBehind.current = false;
        onSectionPointerUp(e);
      }}
      onPointerCancel={onSectionPointerCancel}
      onKeyDown={() => finishMotion(id)}
      onFocus={onFocus}
    >
      <div
        data-titlebar
        className="os-titlebar"
        onPointerDown={handleTitlebarPointerDown}
      >
        {/* Phone back button — only visible in phone mode (CSS). */}
        <button
          type="button"
          data-phone-back
          aria-label={tPhone('back')}
          className="os-phone-back-btn"
          onClick={() => phoneBack(id)}
        >
          {tPhone('back')}
        </button>

        <span className="os-title-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span id={`${id}-title`} className="os-title">
          {title}
        </span>
        {/* Move handle — the grip area doubles as a keyboard-accessible move button. */}
        <button
          type="button"
          data-win-move
          aria-label={t('move', { title })}
          className="os-grip"
          onKeyDown={handleMoveKeyDown}
        />
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

      {/* Body: focusable only when it overflows, with an accessible name. */}
      <div
        ref={body}
        className="os-win-body"
        aria-labelledby={`${id}-title`}
        tabIndex={scrollable ? 0 : -1}
      >
        {children}
      </div>

      {/* Resize handles — 8 directions, pointer-only (keyboard via the move button). */}
      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          data-resize={dir}
          aria-hidden="true"
          onPointerDown={(e) => {
            // Bring window to front on resize start.
            focusApp(id);
            onHandlePointerDown(dir, e);
          }}
        />
      ))}
    </section>
  );
}

function Glyph({ kind }: { kind: keyof typeof WINDOW_GLYPHS }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d={WINDOW_GLYPHS[kind]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
