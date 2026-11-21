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
import { useTranslations } from 'next-intl';
import { useMotionSafe } from '@/components/motion/useMotionSafe';
import { useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { localizedPath } from '@/i18n/localized-path';
import { isCaseApp, type AppId, type CaseAppId } from './apps';
import { isAllowedBrowserUrl } from './browser-allowlist';
import { CaseHost } from './CaseHost';
import { OsContext, type OsInternal, type OsMode } from './context';
import { DESKTOP_QUERY, WALLPAPERS } from './prepaint';
import { caseHref, routedSlugOf } from './route';
import { PREF_KEYS, readPref, SESSION_KEY, readSession, writeSession } from './storage';
import { initialState, nextActiveCase, reduce, serialize, type SavedWindows, type WmState } from './window-manager';
import { desktopBounds } from './shell/desktopBounds';
import { forgetWindow } from './window-memory';
import { BootScreen } from './shell/BootScreen';
import { Toasts, type NotifRepo } from './shell/Toasts';
import { DesktopIcons } from './shell/DesktopIcons';
import { Taskbar } from './shell/Taskbar';
import { ContextMenu } from './shell/ContextMenu';
import { PhoneHome } from './phone/PhoneHome';
import {
  boxOf,
  cancelMotion,
  closeTarget,
  expectOpen,
  finishAllMotion,
  finishMotion,
  openOrigin,
  playClose,
  playMinimize,
  playPhoneClose,
} from './shell/motion';

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
const phoneIcon = (id: AppId) => document.querySelector<HTMLElement>(`[data-phone-icon="${id}"]`);
/** The project the address bar shows right now (history moves update it before React does). */
const urlAt = () => routedSlugOf(window.location.pathname);

/**
 * Phone: where focus returns when an app closes. Its opener if that still
 * shows (an icon on the home screen), else the app's own icon: an opener
 * inside another app is hidden once home shows.
 */
function phoneOpener(id: AppId, opener: HTMLElement | null): HTMLElement | null {
  return opener && isShown(opener) ? opener : phoneIcon(id);
}

/** Whether the app's window shows in this mode (os.css draws it from the same state). */
function showing(state: WmState, id: AppId, mode: OsMode): boolean {
  const win = state.windows[id];
  if (!win.open) return false;
  return mode === 'phone' ? state.phoneActive === id : mode === 'desktop' && !win.minimized;
}

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
  /** Boot screen: total number of projects. */
  projectCount?: number;
  /**
   * Notification source repos — only { slug, lastCommitAt } pairs.
   * Freshness filtering happens client-side so page.clock can control it in e2e tests.
   */
  notifRepos?: NotifRepo[];
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
  projectCount = 0,
  notifRepos = [],
}: Props) {
  const router = useRouter();
  const t = useTranslations('os');
  // Derived in this render, so CaseHost and the page always agree on which
  // project window the page renders: the same window never renders twice.
  const routedSlug = routedSlugOf(usePathname());

  const [state, dispatch] = useReducer(reduce, routedSlug, initialState);
  const mode = useSyncExternalStore(subscribeMode, readMode, readServerMode);
  // False on the server, through hydration and under reduced motion: then
  // every state change is instant and no sequence runs.
  const animate = useMotionSafe().enabled;

  /** URL currently loaded in the browser window (null = start page). */
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);

  // Back, forward and every navigation: the routed project comes to the
  // front. Done while rendering (React's "adjust state when a prop changes"),
  // so the commit that shows a new page already has its window open.
  const [syncedRoute, setSyncedRoute] = useState(routedSlug);
  if (syncedRoute !== routedSlug) {
    setSyncedRoute(routedSlug);
    dispatch({ type: 'route', slug: routedSlug });
  }

  // Event handlers read the latest values through this ref.
  const latest = useRef({ state, routedSlug, mode, animate });
  useLayoutEffect(() => {
    latest.current = { state, routedSlug, mode, animate };
  });

  // ── URL ─────────────────────────────────────────────────────────────────
  // Where the URL is heading: the project of the last navigation that has not
  // landed yet (undefined when none is under way). A visitor can act again
  // before it lands; their last intent must win over it. Any route change
  // settles it.
  const heading = useRef<CaseAppId | null | undefined>(undefined);
  // Ruling R16: the phone's Back on a project this session pushed right on
  // top of home's entry is a history Back, so the system Back cannot bring
  // the app straight back. overHome names that project while its entry is
  // the current one (null: unknown, so Back pushes home instead).
  const pushingOverHome = useRef(false);
  const overHome = useRef<CaseAppId | null>(null);
  // A history Back under way, and the project asked for meanwhile: Next's
  // router lets a Back that lands later cancel a push made now, so that
  // project opens once the Back has landed.
  const back = useRef<{ queued: { id: CaseAppId; opener?: HTMLElement } | null } | null>(null);
  const afterBack = useRef<{ id: CaseAppId; opener?: HTMLElement } | null>(null);
  useLayoutEffect(() => {
    // Only the shell's own push landing tells where its entry sits; Back,
    // Forward or a reload leave it unknown.
    overHome.current = heading.current === routedSlug && pushingOverHome.current ? routedSlug : null;
    pushingOverHome.current = false;
    heading.current = undefined;
    afterBack.current = back.current?.queued ?? null;
    back.current = null;
  }, [routedSlug]);

  /** Every URL move the shell makes is a new history entry. */
  const navigate = useCallback(
    (slug: CaseAppId | null) => {
      // Right on top of home: the address bar on / and no navigation under way.
      pushingOverHome.current = slug !== null && heading.current === undefined && urlAt() === null;
      heading.current = slug;
      router.push(caseHref(slug), { scroll: false });
    },
    [router],
  );

  /** The browser's own Back, to home (the phone's Back, ruling R16). */
  const goBack = useCallback(() => {
    pushingOverHome.current = false;
    heading.current = null;
    back.current = { queued: null };
    router.back();
  }, [router]);

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

  /**
   * URL rule for an open project brought forward (a click, the taskbar,
   * focus): the URL follows it with a new history entry, so Back brings the
   * previous project to the front (spec §7, ruling R15). Nothing is added
   * when the URL already names it, or is on its way there.
   */
  const wantedUrl = useRef<CaseAppId | null>(null);
  const followWithUrl = useCallback(
    (id: CaseAppId) => {
      wantedUrl.current = id;
      afterPointer(() => {
        // Skipped when a later action (another project forward, a close) took over.
        if (wantedUrl.current !== id) return;
        wantedUrl.current = null;
        const url = heading.current !== undefined ? heading.current : latest.current.routedSlug;
        if (url !== id) navigate(id);
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
      // A history Back is under way: the project opens once it lands.
      if (back.current && isCaseApp(id)) {
        back.current.queued = { id, opener };
        return;
      }
      const now = latest.current;
      // Asking for an app again ends whatever it is playing (its final look,
      // now) and drops what was waiting for it, such as its trip home.
      cancelMotion(id);
      // On the phone, another app still closing goes at once.
      if (now.mode === 'phone') finishAllMotion();
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
      // Its window grows from the opener as it appears (WindowFrame plays it).
      if (now.animate && now.mode !== 'document' && !showing(now.state, id, now.mode)) {
        expectOpen(id, openOrigin(id, now.mode, opener));
      }
      focusPlan.current = { kind: 'into', id };
      if (isCaseApp(id)) {
        // Where the URL is, or where a navigation not landed yet takes it.
        const url = heading.current !== undefined ? heading.current : now.routedSlug;
        if (!now.state.windows[id].open) {
          // The route opens it: the page renders its window. Already routed
          // (closed a moment ago, URL not moved yet): open it in place.
          if (url === id) {
            dispatch({ type: 'open', id });
            if (now.mode === 'phone') dispatch({ type: 'phoneOpen', id });
          } else navigate(id);
          return;
        }
        dispatch({ type: 'focus', id });
        if (now.mode === 'phone') dispatch({ type: 'phoneOpen', id });
        if (url !== id) {
          // A navigation away from it is under way (Back, a close): push it
          // again so the visitor's last intent lands last.
          if (heading.current !== undefined) navigate(id);
          else followWithUrl(id);
        }
        return;
      }
      dispatch({ type: 'open', id });
      if (now.mode === 'phone') dispatch({ type: 'phoneOpen', id });
    },
    [navigate, followWithUrl],
  );

  // The project asked for while a history Back was under way: the Back has
  // landed (home, its project windows closed), so it opens now.
  useLayoutEffect(() => {
    const queued = afterBack.current;
    if (!queued) return;
    afterBack.current = null;
    openApp(queued.id, queued.opener);
  }, [routedSlug, openApp]);

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
      finishMotion(id);
      const opener = openers.current.get(id) ?? null;
      const frame = windowElement(id);
      // Desktop: measured while the window still shows; its outline shrinks back from here.
      const from = now.animate && now.mode === 'desktop' ? boxOf(frame) : null;
      openers.current.delete(id);
      forgetWindow(id);
      const ownsUrl = isCaseApp(id) && (now.state.activeCase === id || now.routedSlug === id);
      const next = ownsUrl ? nextActiveCase(now.state, id) : null;
      if (wantedUrl.current === id) wantedUrl.current = null;

      // Closing the browser clears the URL so the next open shows the start page.
      if (id === 'browser') setBrowserUrl(null);

      const routedAt = now.routedSlug;
      // The URL follows the close, unless the visitor moved it meanwhile.
      const go = ownsUrl
        ? () => {
            if (urlAt() === routedAt) navigate(next);
          }
        : undefined;
      // Phone: the app closes back into its icon first (the route would
      // unmount a project's frame mid-way); its state changes at once.
      const held = now.animate && now.mode === 'phone' && frame !== null;
      if (held) playPhoneClose(id, frame, closeTarget(id, 'phone', opener), go);

      dispatch({ type: 'close', id });
      if (now.mode === 'phone') dispatch({ type: 'phoneHome' });
      if (from) playClose(id, from, closeTarget(id, 'desktop', opener));
      const back = now.mode === 'phone' ? phoneOpener(id, opener) : opener;
      focusPlan.current = ownsUrl ? { kind: 'back', to: back, afterRoute: next } : { kind: 'back', to: back };
      if (!held) go?.();
    },
    [navigate],
  );

  /**
   * Open the retro browser and load `url`.
   * Silently refuses URLs that are not in projects[].liveUrl.
   */
  const openBrowser = useCallback(
    (url: string) => {
      if (!isAllowedBrowserUrl(url)) return;
      setBrowserUrl(url);
      openApp('browser');
    },
    [openApp],
  );

  const minimizeApp = useCallback((id: AppId) => {
    const now = latest.current;
    finishMotion(id);
    const win = now.state.windows[id];
    const frame = windowElement(id);
    // The window scales into its taskbar button; its state is minimised at once.
    if (now.animate && now.mode === 'desktop' && win.open && !win.minimized && frame) {
      playMinimize(id, frame, boxOf(document.querySelector(`[data-task="${id}"]`)));
    }
    dispatch({ type: 'minimize', id });
    focusPlan.current = { kind: 'back', to: null };
  }, []);

  const phoneBack = useCallback(
    (id: AppId) => {
      const now = latest.current;
      finishMotion(id);
      const opener = openers.current.get(id) ?? null;
      const frame = windowElement(id);
      const routedAt = now.routedSlug;
      // A project goes home: / → route(null) → closes every project window.
      // Opened from home in this session, it goes back to home's own entry
      // (ruling R16); landed on directly, home is pushed. A non-case app
      // stays open (its state is preserved), just not in front.
      const go = isCaseApp(id)
        ? () => {
            if (urlAt() !== routedAt) return;
            if (overHome.current === id) goBack();
            else navigate(null);
          }
        : undefined;
      // Home shows at once; the app closes back into its icon, and a
      // project's trip home waits for it (the route unmounts its frame).
      if (now.animate && frame) playPhoneClose(id, frame, closeTarget(id, 'phone', opener), go);
      else go?.();
      dispatch({ type: 'phoneHome' });
      // Focus goes back to what opened it (the icon, once home shows).
      focusPlan.current = { kind: 'back', to: phoneOpener(id, opener) };
    },
    [navigate, goBack],
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
      // Nothing mid-animation survives the switch: every window shows as it is.
      finishAllMotion();
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
      openBrowser,
      browserUrl,
    }),
    [state, mode, locale, routedSlug, openApp, closeApp, focusApp, registerCase, cases, dropCase, minimizeApp, phoneBack, openBrowser, browserUrl],
  );

  // The pathname is used for the document-mode language links (os-nojs-only).
  // On the server these match the request URL; on the client usePathname() is live.
  const pathname = usePathname();

  return (
    <OsContext value={os}>
      {/* Boot screen overlay — visible only on first visit (html[data-boot="1"]).
          Renders server-side so the lines appear on the first paint; JS handles
          the timer and skip-on-input logic.  Content renders underneath it. */}
      <BootScreen projectCount={projectCount} totalCommits={totalCommits} />

      {/* Toast notifications — once per session, after the boot clears. */}
      <Toasts repos={notifRepos} locale={locale} />

      {/* R5: Document-mode language links. Hidden via CSS once data-os is set.
          They render in the SSR HTML so a no-JS visitor can switch language. */}
      <nav aria-label={t('taskbar.language')} className="os-nojs-only os-doc-lang">
        {LOCALES_NOJS.map(({ code, label }) => (
          <a key={code} href={localizedPath(pathname, code)} hrefLang={code} className="os-doc-lang-link">
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

      {/* All windows. On the phone only the app in use shows (os.css hides
          the rest), so the page's h1 stays in reach on the home screen. */}
      <main data-windows>
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

      {/* Where the open/close outlines are drawn (src/os/shell/motion.ts). */}
      <div data-motion-layer aria-hidden="true" className="os-motion-layer" />
    </OsContext>
  );
}
