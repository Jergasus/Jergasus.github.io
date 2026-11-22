import { apps, getApp, isCaseApp } from './apps';
import type { AppId, CaseAppId, FracRect, Rect } from './apps';

export type { AppId, CaseAppId, Rect, FracRect };

export interface Size {
  w: number;
  h: number;
}

export interface WinState {
  open: boolean;
  minimized: boolean;
  maximized: boolean;
  rect: Rect | null;
  z: number;
}

export interface WmState {
  windows: Record<AppId, WinState>;
  focused: AppId | null;
  nextZ: number;
  phoneActive: AppId | null;
  /** The most recently opened or focused case window still open; drives the URL. */
  activeCase: CaseAppId | null;
}

export type SavedWindows = Partial<
  Record<AppId, { open: boolean; minimized: boolean; maximized: boolean; rect: Rect | null }>
>;

export type WmAction =
  | { type: 'open'; id: AppId }
  | { type: 'close'; id: AppId }
  | { type: 'focus'; id: AppId }
  | { type: 'minimize'; id: AppId }
  | { type: 'toggleMaximize'; id: AppId }
  | { type: 'setRect'; id: AppId; rect: Rect; bounds: Size }
  /** left: where the cascade starts, clear of the desktop icons (default 128). */
  | { type: 'arrange'; bounds: Size; left?: number }
  | { type: 'reclamp'; bounds: Size }
  | { type: 'route'; slug: CaseAppId | null }
  | { type: 'phoneOpen'; id: AppId }
  | { type: 'phoneHome' }
  | { type: 'hydrate'; saved: SavedWindows };

export const TITLEBAR_H = 30;
export const MIN_VISIBLE_X = 64;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Convert a fractional rect to pixel coords, rounding to the nearest pixel. */
export function fracToRect(f: FracRect, bounds: Size): Rect {
  return {
    x: Math.round(f.x * bounds.w),
    y: Math.round(f.y * bounds.h),
    w: Math.round(f.w * bounds.w),
    h: Math.round(f.h * bounds.h),
  };
}

/**
 * Clamp a window rect so that:
 *  - width/height are within [min, bounds]
 *  - the title bar stays within vertical bounds
 *  - at least MIN_VISIBLE_X pixels are visible horizontally on each side
 */
export function clampRect(rect: Rect, bounds: Size, min: Size): Rect {
  const w = Math.max(min.w, Math.min(rect.w, bounds.w));
  const h = Math.max(min.h, Math.min(rect.h, bounds.h));
  const x = Math.max(-(w - MIN_VISIBLE_X), Math.min(rect.x, bounds.w - MIN_VISIBLE_X));
  const y = Math.max(0, Math.min(rect.y, bounds.h - TITLEBAR_H));
  return { x, y, w, h };
}

/**
 * Build a map of AppId → Rect by cascading windows from (24,24) with +32 px per step.
 * Each window uses its app's default fractional size scaled to bounds.
 */
export function cascade(ids: AppId[], bounds: Size, left = 128): Partial<Record<AppId, Rect>> {
  const result: Partial<Record<AppId, Rect>> = {};
  ids.forEach((id, i) => {
    const def = getApp(id);
    if (!def) return;
    const { w, h } = fracToRect(def.defaultRect, bounds);
    // R8: clear of the icons. One 120px column + 8px gap = 128px by default;
    // the shell passes the measured edge when the icons take two columns.
    result[id] = { x: left + 32 * i, y: 24 + 32 * i, w, h };
  });
  return result;
}

/** Open (and not minimized) windows sorted by ascending z. */
export function visibleOrder(state: WmState): AppId[] {
  return (Object.entries(state.windows) as [AppId, WinState][])
    .filter(([, w]) => w.open && !w.minimized)
    .sort(([, a], [, b]) => a.z - b.z)
    .map(([id]) => id);
}

/**
 * Persist the per-window open/minimized/maximized/rect flags.
 * z is intentionally excluded — it is session-only.
 */
export function serialize(state: WmState): SavedWindows {
  const result: SavedWindows = {};
  for (const [id, win] of Object.entries(state.windows) as [AppId, WinState][]) {
    result[id] = { open: win.open, minimized: win.minimized, maximized: win.maximized, rect: win.rect };
  }
  return result;
}

/** The topmost other open case window by z, or null. Used when closing the active case. */
const CASE_IDS: readonly CaseAppId[] = ['questday', 'sakurai', 'rally-voley'];

export function nextActiveCase(state: WmState, closing: CaseAppId): CaseAppId | null {
  const candidates = CASE_IDS
    .filter((id) => id !== closing && state.windows[id].open)
    .sort((a, b) => state.windows[b].z - state.windows[a].z);
  return candidates[0] ?? null;
}

// ---------------------------------------------------------------------------
// initialState
// ---------------------------------------------------------------------------

/**
 * Build the starting WmState for a given URL route.
 *
 * Open: about (z=1), projects (z=2), and the route case app (z=3) if any.
 * rect is null for all windows — the UI converts defaultRect on first render.
 * focused = route ?? 'projects'; phoneActive = route; activeCase = route.
 */
export function initialState(route: CaseAppId | null): WmState {
  const windows = {} as Record<AppId, WinState>;
  for (const app of apps) {
    windows[app.id] = { open: false, minimized: false, maximized: false, rect: null, z: 0 };
  }

  windows['about'] = { open: true, minimized: false, maximized: false, rect: null, z: 1 };
  windows['projects'] = { open: true, minimized: false, maximized: false, rect: null, z: 2 };

  let nextZ = 3;
  if (route !== null) {
    windows[route] = { open: true, minimized: false, maximized: false, rect: null, z: 3 };
    nextZ = 4;
  }

  return {
    windows,
    focused: route ?? 'projects',
    nextZ,
    phoneActive: route,
    activeCase: route,
  };
}

// ---------------------------------------------------------------------------
// Reducer helpers
// ---------------------------------------------------------------------------

/** Find the visible window with the highest z (excluding a given id). */
function topVisibleExcluding(state: WmState, exclude: AppId): AppId | null {
  const best = (Object.entries(state.windows) as [AppId, WinState][])
    .filter(([id, w]) => id !== exclude && w.open && !w.minimized)
    .sort(([, a], [, b]) => b.z - a.z);
  return best.length > 0 ? best[0][0] : null;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function reduce(state: WmState, action: WmAction): WmState {
  switch (action.type) {
    // -----------------------------------------------------------------------
    case 'open': {
      const { id } = action;
      const win = state.windows[id];
      const alreadyOnTop =
        win.open && !win.minimized && state.focused === id && win.z === state.nextZ - 1;
      if (alreadyOnTop && (!isCaseApp(id) || state.activeCase === id)) {
        return state; // no-op
      }
      const newWin: WinState = { ...win, open: true, minimized: false, z: state.nextZ };
      const result: WmState = {
        ...state,
        windows: { ...state.windows, [id]: newWin },
        focused: id,
        nextZ: state.nextZ + 1,
      };
      if (isCaseApp(id)) result.activeCase = id;
      return result;
    }

    // -----------------------------------------------------------------------
    case 'close': {
      const { id } = action;
      const win = state.windows[id];
      if (!win.open) return state; // no-op

      const newWin: WinState = { ...win, open: false, maximized: false };
      const newWindows = { ...state.windows, [id]: newWin };

      // Move focus to next topmost visible (using old state before close)
      const focused: AppId | null =
        state.focused === id ? topVisibleExcluding(state, id) : state.focused;

      // Update activeCase if the closed window was the active case
      let activeCase = state.activeCase;
      if (isCaseApp(id) && state.activeCase === id) {
        activeCase = nextActiveCase(state, id);
      }

      // Carried item (Task 8): closing the active phone app clears phoneActive.
      const phoneActive = state.phoneActive === id ? null : state.phoneActive;

      return { ...state, windows: newWindows, focused, activeCase, phoneActive };
    }

    // -----------------------------------------------------------------------
    case 'focus': {
      const { id } = action;
      const win = state.windows[id];
      if (!win.open) return state; // cannot focus a closed window

      const alreadyOnTop = !win.minimized && state.focused === id && win.z === state.nextZ - 1;
      if (alreadyOnTop && (!isCaseApp(id) || state.activeCase === id)) {
        return state; // no-op
      }

      const newWin: WinState = { ...win, minimized: false, z: state.nextZ };
      const result: WmState = {
        ...state,
        windows: { ...state.windows, [id]: newWin },
        focused: id,
        nextZ: state.nextZ + 1,
      };
      if (isCaseApp(id)) result.activeCase = id;
      return result;
    }

    // -----------------------------------------------------------------------
    case 'minimize': {
      const { id } = action;
      const win = state.windows[id];
      if (!win.open || win.minimized) return state; // no-op

      const newWin: WinState = { ...win, minimized: true };
      const newWindows = { ...state.windows, [id]: newWin };
      const focused: AppId | null =
        state.focused === id ? topVisibleExcluding(state, id) : state.focused;

      return { ...state, windows: newWindows, focused };
    }

    // -----------------------------------------------------------------------
    case 'toggleMaximize': {
      const { id } = action;
      const win = state.windows[id];
      const newWin: WinState = { ...win, maximized: !win.maximized };
      return { ...state, windows: { ...state.windows, [id]: newWin } };
    }

    // -----------------------------------------------------------------------
    case 'setRect': {
      const { id, rect, bounds } = action;
      const win = state.windows[id];
      const appDef = getApp(id);
      const min = appDef?.minSize ?? { w: 100, h: 100 };
      const clamped = clampRect(rect, bounds, min);
      const newWin: WinState = { ...win, rect: clamped };
      return { ...state, windows: { ...state.windows, [id]: newWin } };
    }

    // -----------------------------------------------------------------------
    case 'arrange': {
      const order = visibleOrder(state);
      const rects = cascade(order, action.bounds, action.left);
      const newWindows = { ...state.windows };
      for (const id of order) {
        const r = rects[id];
        if (!r) continue;
        const appDef = getApp(id);
        const min = appDef?.minSize ?? { w: 100, h: 100 };
        newWindows[id] = { ...newWindows[id], rect: clampRect(r, action.bounds, min) };
      }
      return { ...state, windows: newWindows };
    }

    // -----------------------------------------------------------------------
    case 'reclamp': {
      const newWindows = { ...state.windows };
      let changed = false;
      for (const [id, win] of Object.entries(state.windows) as [AppId, WinState][]) {
        if (!win.open || !win.rect) continue;
        const appDef = getApp(id);
        const min = appDef?.minSize ?? { w: 100, h: 100 };
        const clamped = clampRect(win.rect, action.bounds, min);
        if (
          clamped.x !== win.rect.x ||
          clamped.y !== win.rect.y ||
          clamped.w !== win.rect.w ||
          clamped.h !== win.rect.h
        ) {
          newWindows[id] = { ...win, rect: clamped };
          changed = true;
        }
      }
      return changed ? { ...state, windows: newWindows } : state;
    }

    // -----------------------------------------------------------------------
    case 'route': {
      const { slug } = action;

      if (slug === null) {
        // Home means no project windows (ruling R7), on the desktop and the phone.
        const openCases = CASE_IDS.filter((id) => state.windows[id].open);
        const casePhoneApp = state.phoneActive !== null && isCaseApp(state.phoneActive);
        if (openCases.length === 0 && state.activeCase === null && !casePhoneApp) {
          return state; // no-op
        }
        const windows = { ...state.windows };
        for (const id of openCases) windows[id] = { ...windows[id], open: false, maximized: false };
        const focused =
          state.focused !== null && isCaseApp(state.focused)
            ? topVisibleExcluding({ ...state, windows }, state.focused)
            : state.focused;
        // A non-case phone app opened while the URL was on its way home is the
        // visitor's last intent: it stays in front.
        const phoneActive = casePhoneApp ? null : state.phoneActive;
        return { ...state, windows, focused, activeCase: null, phoneActive };
      }

      // Open (or bring to front) the case window
      const win = state.windows[slug];
      const alreadyOnTop =
        win.open && !win.minimized && state.focused === slug && win.z === state.nextZ - 1;
      if (alreadyOnTop && state.activeCase === slug && state.phoneActive === slug) {
        return state; // no-op
      }

      const newWin: WinState = { ...win, open: true, minimized: false, z: state.nextZ };
      return {
        ...state,
        windows: { ...state.windows, [slug]: newWin },
        focused: slug,
        nextZ: state.nextZ + 1,
        activeCase: slug,
        phoneActive: slug,
      };
    }

    // -----------------------------------------------------------------------
    case 'phoneOpen': {
      const { id } = action;
      if (state.phoneActive === id) return state; // no-op
      return { ...state, phoneActive: id };
    }

    // -----------------------------------------------------------------------
    case 'phoneHome': {
      if (state.phoneActive === null) return state; // no-op
      return { ...state, phoneActive: null };
    }

    // -----------------------------------------------------------------------
    case 'hydrate': {
      const { saved } = action;
      const newWindows = { ...state.windows };
      let changed = false;
      let nextZ = state.nextZ;

      for (const id of Object.keys(saved) as AppId[]) {
        const savedWin = saved[id];
        if (!savedWin) continue;
        const current = newWindows[id];
        if (!current) continue;

        if (isCaseApp(id)) {
          // For case apps: apply rect and maximized only for the routed case window.
          // Never open a case window that is not routed.
          if (id !== state.activeCase) continue;
          const next: WinState = {
            ...current,
            rect: savedWin.rect ?? current.rect,
            maximized: savedWin.maximized,
          };
          if (next.rect !== current.rect || next.maximized !== current.maximized) {
            newWindows[id] = next;
            changed = true;
          }
        } else {
          // For non-case apps: apply the full saved state.
          // When re-opening a window that was closed in initialState, assign a real z so it
          // renders above the default windows (which start at z=1 and z=2).
          const wasOpen = current.open;
          const willOpen = savedWin.open;
          const z = willOpen && !wasOpen ? nextZ++ : current.z;
          const next: WinState = {
            ...current,
            open: savedWin.open,
            minimized: savedWin.minimized,
            maximized: savedWin.maximized,
            rect: savedWin.rect ?? current.rect,
            z,
          };
          if (
            next.open !== current.open ||
            next.minimized !== current.minimized ||
            next.maximized !== current.maximized ||
            next.rect !== current.rect ||
            next.z !== current.z
          ) {
            newWindows[id] = next;
            changed = true;
          }
        }
      }

      return changed ? { ...state, windows: newWindows, nextZ } : state;
    }

    // -----------------------------------------------------------------------
    default: {
      // TypeScript exhaustiveness guard
      const _: never = action;
      return state;
    }
  }
}
