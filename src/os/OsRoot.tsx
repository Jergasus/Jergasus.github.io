'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { localizedPath } from '@/i18n/localized-path';
import { isCaseApp, type AppId, type CaseAppId } from './apps';
import { CaseHost } from './CaseHost';
import { OsContext, type OsInternal, type OsMode } from './context';
import { DESKTOP_QUERY, WALLPAPERS } from './prepaint';
import { caseHref, routedSlugOf } from './route';
import { PREF_KEYS, readPref, SESSION_KEY, readSession, writeSession } from './storage';
import { initialState, nextActiveCase, reduce, serialize, type SavedWindows } from './window-manager';
import { desktopBounds } from './shell/desktopBounds';
import { forgetWindow } from './window-memory';
import { DesktopIcons } from './shell/DesktopIcons';
import { Taskbar } from './shell/Taskbar';
import { ContextMenu } from './shell/ContextMenu';
import { PhoneHome } from './phone/PhoneHome';

export { useOs } from './context';
export type { OsApi, OsMode } from './context';

// ── Mode ──────────────────────────────────────────────────────────────────
// html[data-os] is set by the pre-paint script before the first paint, so the
// server cannot know it: the server snapshot is 'document', and the client
// reads the attribute once hydrated. The mode only drives behaviour; CSS does
// the layout from the same attribute.

function subscribeMode(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-os'] });
  return () => observer.disconnect();
}

function readMode(): OsMode {
  const mode = document.documentElement.getAttribute('data-os');
  return mode === 'desktop' || mode === 'phone' ? mode : 'document';
}

const readServerMode = (): OsMode => 'document';

/** Laid out and showing (display: none and detached elements are not). */
function isShown(element: Element | null | undefined): element is HTMLElement {
  return element instanceof HTMLElement && element.isConnected && element.getClientRects().length > 0;
}

const windowElement = (id: AppId) => document.querySelector<HTMLElement>(`[data-app="${id}"]`);

/** Where keyboard focus goes once the next commits settle. */
type FocusPlan =
  | { kind: 'into'; id: AppId }
  | { kind: 'back'; to: HTMLElement | null; afterRoute?: CaseAppId | null };

type Props = {
  locale: Locale;
  children: ReactNode;
  available?: boolean;
  availabilityLabel?: string;
  /** Phone home screen data — all passed from the server so no extra client namespace is needed. */
  name?: string;
  lede?: string;
  totalCommits?: number;
  lastCommitAt?: string;
  weekly?: number[];
  whatsappMessage?: string;
};

const LOCALES_NOJS: { code: Locale; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'ca', label: 'CA' },
  { code: 'en', label: 'EN' },
];

export function OsRoot({
  locale,
  children,
  available = false,
  availabilityLabel = '',
  name = '',
  lede = '',
  totalCommits = 0,
  lastCommitAt = new Date().toISOString(),
  weekly = new Array<number>(26).fill(0),
  whatsappMessage = '',
}: Props) {
  const router = useRouter();
  // Derived in this render, so CaseHost and the page always agree on which
  // project window the page renders: the same window never renders twice.
  const routedSlug = routedSlugOf(usePathname());

  const [state, dispatch] = useReducer(reduce, routedSlug, initialState);
  const mode = useSyncExternalStore(subscribeMode, readMode, readServerMode);

  // Back, forward and every navigation: the routed project comes to the
  // front. Done while rendering (React's "adjust state when a prop changes"),
  // so the commit that shows a new page already has its window open.
  const [syncedRoute, setSyncedRoute] = useState(routedSlug);
  if (syncedRoute !== routedSlug) {
    setSyncedRoute(routedSlug);
    dispatch({ type: 'route', slug: routedSlug });
  }

  // Event handlers read the latest values through this ref.
  const latest = useRef({ state, routedSlug, mode });
  useLayoutEffect(() => {
    latest.current = { state, routedSlug, mode };
  });

  // ── URL ─────────────────────────────────────────────────────────────────
  const navigate = useCallback(
    (how: 'push' | 'replace', slug: CaseAppId | null) => {
      router[how](caseHref(slug), { scroll: false });
    },
    [router],
  );

  // Bringing a project forward with the pointer changes the URL only once the
  // click is over: the new URL remounts the window (the page renders it), and
  // a remount between press and release would swallow a click on a link
  // inside it.
  const pointer = useRef<{ down: boolean; queued: (() => void) | null; timer: number }>({
    down: false,
    queued: null,
    timer: 0,
  });
  const afterPointer = useCallback((task: () => void) => {
    if (pointer.current.down) pointer.current.queued = task;
    else task();
  }, []);
  useEffect(() => {
    const p = pointer.current;
    const flush = () => {
      window.clearTimeout(p.timer);
      const task = p.queued;
      p.queued = null;
      task?.();
    };
    const onDown = () => {
      p.down = true;
    };
    const onUp = () => {
      p.down = false;
      // A press that ends without a click (a drag) still gets its URL.
      if (p.queued) p.timer = window.setTimeout(flush, 400);
    };
    const onClick = () => {
      if (p.queued) window.setTimeout(flush, 0);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      window.removeEventListener('click', onClick, true);
      window.clearTimeout(p.timer);
    };
  }, []);

  /** URL rule for a project brought forward: the URL follows it, with no new history entry. */
  const wantedUrl = useRef<CaseAppId | null>(null);
  const followWithUrl = useCallback(
    (id: CaseAppId) => {
      wantedUrl.current = id;
      afterPointer(() => {
        // Skipped when a later action (another project forward, a close) took over.
        if (wantedUrl.current !== id) return;
        wantedUrl.current = null;
        if (latest.current.routedSlug !== id) navigate('replace', id);
      });
    },
    [afterPointer, navigate],
  );

  // ── Focus ───────────────────────────────────────────────────────────────
  const openers = useRef(new Map<AppId, HTMLElement>());
  const focusPlan = useRef<FocusPlan | null>(null);

  useEffect(() => {
    const plan = focusPlan.current;
    if (!plan) return;
    if (plan.kind === 'into') {
      const section = windowElement(plan.id);
      if (state.windows[plan.id].open && isShown(section)) {
        focusPlan.current = null;
        section.focus();
      }
      return;
    }
    // Closing the routed project moves the URL: wait for it to land.
    if (plan.afterRoute !== undefined && plan.afterRoute !== routedSlug) return;
    focusPlan.current = null;
    if (isShown(plan.to)) {
      plan.to.focus();
      return;
    }
    const top = state.focused ? windowElement(state.focused) : null;
    if (isShown(top)) top.focus();
  });

  // ── Apps ────────────────────────────────────────────────────────────────
  const openApp = useCallback(
    (id: AppId, opener?: HTMLElement) => {
      const now = latest.current;
      if (opener) openers.current.set(id, opener);
      const win = now.state.windows[id];
      const section = windowElement(id);
      const inFront =
        now.state.focused === id && win.open && !win.minimized && (!isCaseApp(id) || now.routedSlug === id);
      if (inFront && isShown(section)) {
        // Already the window in front: nothing changes but focus.
        section.focus();
        return;
      }
      focusPlan.current = { kind: 'into', id };
      if (isCaseApp(id)) {
        if (!now.state.windows[id].open) {
          // The route opens it: the page renders its window. Already routed
          // (closed a moment ago, URL not moved yet): open it in place.
          if (now.routedSlug === id) dispatch({ type: 'open', id });
          else navigate('push', id);
          return;
        }
        dispatch({ type: 'focus', id });
        if (now.mode === 'phone') dispatch({ type: 'phoneOpen', id });
        if (now.routedSlug !== id) followWithUrl(id);
        return;
      }
      dispatch({ type: 'open', id });
      if (now.mode === 'phone') dispatch({ type: 'phoneOpen', id });
    },
    [navigate, followWithUrl],
  );

  const focusApp = useCallback(
    (id: AppId) => {
      const now = latest.current;
      if (!now.state.windows[id].open) return;
      dispatch({ type: 'focus', id });
      if (isCaseApp(id) && now.routedSlug !== id) followWithUrl(id);
    },
    [followWithUrl],
  );

  const [cases, setCases] = useState<Partial<Record<CaseAppId, ReactNode>>>({});

  const registerCase = useCallback((slug: CaseAppId, node: ReactNode) => {
    setCases((cached) => (cached[slug] === node ? cached : { ...cached, [slug]: node }));
  }, []);

  const dropCase = useCallback((slug: CaseAppId) => {
    setCases((cached) => {
      if (!(slug in cached)) return cached;
      const rest = { ...cached };
      delete rest[slug];
      return rest;
    });
  }, []);

  const closeApp = useCallback(
    (id: AppId) => {
      const now = latest.current;
      if (!now.state.windows[id].open) return;
      const opener = openers.current.get(id) ?? null;
      openers.current.delete(id);
      forgetWindow(id);
      const ownsUrl = isCaseApp(id) && (now.state.activeCase === id || now.routedSlug === id);
      const next = ownsUrl ? nextActiveCase(now.state, id) : null;
      if (wantedUrl.current === id) wantedUrl.current = null;

      dispatch({ type: 'close', id });
      if (now.mode === 'phone') dispatch({ type: 'phoneHome' });
      focusPlan.current = ownsUrl ? { kind: 'back', to: opener, afterRoute: next } : { kind: 'back', to: opener };
      if (ownsUrl) navigate('push', next);
    },
    [navigate],
  );

  const minimizeApp = useCallback((id: AppId) => {
    dispatch({ type: 'minimize', id });
    focusPlan.current = { kind: 'back', to: null };
  }, []);

  const phoneBack = useCallback(
    (id: AppId) => {
      if (isCaseApp(id)) {
        // Navigate to / → triggers route(null) → closes cases, clears phoneActive.
        navigate('push', null);
      } else {
        // Just go home without closing the window so its state is preserved.
        dispatch({ type: 'phoneHome' });
        focusPlan.current = { kind: 'back', to: null };
      }
    },
    [navigate],
  );

  // ── Session persistence ──────────────────────────────────────────────────

  // On mount: hydrate window state from the session (same tab, reload) and
  // immediately reclamp to the current desktop size.
  // useLayoutEffect (not useEffect) so hydration applies before the first paint,
  // avoiding a visible position jump on reload.
  useLayoutEffect(() => {
    const saved = readSession<SavedWindows>(SESSION_KEY);
    if (saved) {
      dispatch({ type: 'hydrate', saved });
      dispatch({ type: 'reclamp', bounds: desktopBounds() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce persisting: write 200 ms after the last state change so we do
  // not thrash sessionStorage on rapid pointer events.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      writeSession(SESSION_KEY, serialize(state));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [state]);

  // ── Desktop bounds ───────────────────────────────────────────────────────

  // Reclamp all windows whenever the desktop resizes (viewport resize or
  // taskbar height change): ensures no window is permanently off-screen.
  useEffect(() => {
    const desktop = document.querySelector<HTMLElement>('[data-desktop]');
    if (!desktop) return;
    const obs = new ResizeObserver(() => {
      const { w, h } = desktopBounds();
      dispatch({ type: 'reclamp', bounds: { w, h } });
    });
    obs.observe(desktop);
    return () => obs.disconnect();
  }, []);

  // ── Environment ─────────────────────────────────────────────────────────
  // React's development remount (Strict Mode) resets <html> to the attributes
  // it renders, dropping what the pre-paint script set: put them back. A
  // production page always has them already.
  useLayoutEffect(() => {
    const html = document.documentElement;
    if (html.hasAttribute('data-os')) return;
    html.setAttribute('data-os', window.matchMedia(DESKTOP_QUERY).matches ? 'desktop' : 'phone');
    const wallpaper = readPref(PREF_KEYS.wallpaper);
    html.setAttribute(
      'data-wallpaper',
      wallpaper && (WALLPAPERS as readonly string[]).includes(wallpaper) ? wallpaper : 'dots',
    );
    const theme = readPref(PREF_KEYS.theme);
    if (theme === 'light' || theme === 'dark') html.setAttribute('data-theme', theme);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    // Crossing the breakpoint switches between desktop and phone, keeping state in sync.
    const desktopMq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (!html.hasAttribute('data-os')) return;
      const { state: s } = latest.current;
      if (desktopMq.matches) {
        // Phone → desktop: focus the previously active phone app if still open.
        html.setAttribute('data-os', 'desktop');
        if (s.phoneActive && s.windows[s.phoneActive]?.open) {
          dispatch({ type: 'focus', id: s.phoneActive });
        }
      } else {
        // Desktop → phone: set phoneActive to the focused case window, if any.
        html.setAttribute('data-os', 'phone');
        const focusedCase = s.focused && isCaseApp(s.focused) ? s.focused : null;
        if (focusedCase !== s.phoneActive) {
          if (focusedCase) dispatch({ type: 'phoneOpen', id: focusedCase });
          else dispatch({ type: 'phoneHome' });
        }
      }
    };
    desktopMq.addEventListener('change', onChange);
    // Hydrated: from here on the windows answer clicks and keys.
    html.setAttribute('data-os-ready', '1');
    return () => desktopMq.removeEventListener('change', onChange);
  }, []);

  const os = useMemo<OsInternal>(
    () => ({
      state,
      dispatch,
      mode,
      locale,
      routedSlug,
      openApp,
      closeApp,
      focusApp,
      registerCase,
      cases,
      dropCase,
      minimizeApp,
      phoneBack,
    }),
    [state, mode, locale, routedSlug, openApp, closeApp, focusApp, registerCase, cases, dropCase, minimizeApp, phoneBack],
  );

  // The pathname is used for the document-mode language links (os-nojs-only).
  // On the server these match the request URL; on the client usePathname() is live.
  const pathname = usePathname();

  return (
    <OsContext value={os}>
      {/* R5: Document-mode language links. Hidden via CSS once data-os is set.
          They render in the SSR HTML so a no-JS visitor can switch language. */}
      <nav aria-label="Language" className="os-nojs-only os-doc-lang">
        {LOCALES_NOJS.map(({ code, label }) => (
          <a key={code} href={localizedPath(pathname, code)} className="os-doc-lang-link">
            {label}
          </a>
        ))}
      </nav>

      {/* Phone home screen — hidden on desktop/document via CSS */}
      <PhoneHome
        locale={locale}
        available={available}
        availabilityLabel={availabilityLabel}
        name={name}
        lede={lede}
        totalCommits={totalCommits}
        lastCommitAt={lastCommitAt}
        weekly={weekly}
        whatsappMessage={whatsappMessage}
      />

      {/* Desktop wallpaper and icon column */}
      <div data-desktop>
        <DesktopIcons />
      </div>

      {/* All windows — hidden from AT in phone mode when no app is active.
          When an app IS phoneActive it is focused and must remain visible to AT. */}
      <main data-windows aria-hidden={mode === 'phone' && !state.phoneActive ? 'true' : undefined}>
        {children}
        <CaseHost />
      </main>

      {/* Taskbar: start button, task buttons, tray */}
      <Taskbar
        locale={locale}
        available={available}
        availabilityLabel={availabilityLabel}
      />

      {/* Right-click context menu */}
      <ContextMenu />
    </OsContext>
  );
}
