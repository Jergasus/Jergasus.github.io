import { expect, test } from 'vitest';
import {
  initialState,
  nextActiveCase,
  reduce,
  clampRect,
  fracToRect,
  cascade,
  visibleOrder,
  serialize,
  TITLEBAR_H,
  MIN_VISIBLE_X,
} from './window-manager';
import { getApp } from './apps';
import type { CaseAppId, AppId } from './apps';
import type { SavedWindows } from './window-manager';

// ---------------------------------------------------------------------------
// initialState
// ---------------------------------------------------------------------------

test('home starts with about and projects open, projects focused', () => {
  const s = initialState(null);
  expect(visibleOrder(s)).toEqual(['about', 'projects']);
  expect(s.focused).toBe('projects');
  expect(s.activeCase).toBeNull();
  expect(s.phoneActive).toBeNull();
});

test('route opens the case window and sets focused/activeCase/phoneActive', () => {
  const s = initialState('questday');
  expect(visibleOrder(s)).toEqual(['about', 'projects', 'questday']);
  expect(s.focused).toBe('questday');
  expect(s.activeCase).toBe('questday');
  expect(s.phoneActive).toBe('questday');
});

// ---------------------------------------------------------------------------
// route action
// ---------------------------------------------------------------------------

test('route opens and focuses the case window and sets activeCase; other case windows stay open', () => {
  const s0 = initialState('questday');
  // Route to sakurai — questday must stay open
  const s1 = reduce(s0, { type: 'route', slug: 'sakurai' });
  expect(s1.windows.questday.open).toBe(true);
  expect(s1.activeCase).toBe('sakurai');
  expect(s1.focused).toBe('sakurai');
  // Extra focus on sakurai is a no-op
  const s2 = reduce(s1, { type: 'focus', id: 'sakurai' });
  expect(s2).toBe(s1);
});

// Ruling R7: home means no project windows, on the desktop and the phone.
test('route null closes every case window, clears activeCase and the phone app, and focuses the top other window', () => {
  let s = initialState('questday');
  s = reduce(s, { type: 'route', slug: 'sakurai' });
  s = reduce(s, { type: 'toggleMaximize', id: 'sakurai' });
  const s1 = reduce(s, { type: 'route', slug: null });
  expect(s1.activeCase).toBeNull();
  expect(s1.phoneActive).toBeNull();
  expect(s1.windows.questday.open).toBe(false);
  expect(s1.windows.sakurai.open).toBe(false);
  expect(s1.windows.sakurai.maximized).toBe(false);
  expect(visibleOrder(s1)).toEqual(['about', 'projects']);
  expect(s1.focused).toBe('projects');
});

test('route null keeps a non-case window that has focus', () => {
  let s = initialState('questday');
  s = reduce(s, { type: 'focus', id: 'about' });
  const s1 = reduce(s, { type: 'route', slug: null });
  expect(s1.windows.questday.open).toBe(false);
  expect(s1.focused).toBe('about');
});

test('route null at home with no case window open is a no-op', () => {
  const s0 = initialState(null);
  expect(reduce(s0, { type: 'route', slug: null })).toBe(s0);
});

// ---------------------------------------------------------------------------
// focus / activeCase
// ---------------------------------------------------------------------------

test('focusing an open case window makes it activeCase; focusing a non-case window does not change activeCase', () => {
  let s = initialState('questday');
  // Focus about (non-case): activeCase stays questday
  s = reduce(s, { type: 'focus', id: 'about' });
  expect(s.focused).toBe('about');
  expect(s.activeCase).toBe('questday');
  // Open and focus sakurai: activeCase updates
  s = reduce(s, { type: 'open', id: 'sakurai' });
  expect(s.focused).toBe('sakurai');
  expect(s.activeCase).toBe('sakurai');
});

test('focus raises z without changing others', () => {
  const s0 = initialState(null); // about z=1, projects z=2, nextZ=3
  const s1 = reduce(s0, { type: 'focus', id: 'about' }); // about z=3
  expect(s1.windows.about.z).toBe(3);
  expect(s1.windows.projects.z).toBe(2); // unchanged
  expect(s1.focused).toBe('about');
  expect(s1.nextZ).toBe(4);
});

// ---------------------------------------------------------------------------
// close
// ---------------------------------------------------------------------------

test('closing the active case window sets activeCase to the topmost other open case window, else null', () => {
  // Open two case windows
  let s = initialState('questday'); // questday z=3
  s = reduce(s, { type: 'route', slug: 'sakurai' }); // sakurai z=4, activeCase=sakurai
  // Close sakurai (the active case)
  s = reduce(s, { type: 'close', id: 'sakurai' });
  expect(s.windows.sakurai.open).toBe(false);
  expect(s.activeCase).toBe('questday'); // next topmost open case by z
  // Close questday too
  s = reduce(s, { type: 'close', id: 'questday' });
  expect(s.activeCase).toBeNull();
});

test('close clears focus and maximize state', () => {
  let s = initialState(null); // about z=1, projects z=2, focused=projects
  s = reduce(s, { type: 'toggleMaximize', id: 'projects' });
  expect(s.windows.projects.maximized).toBe(true);
  s = reduce(s, { type: 'close', id: 'projects' });
  expect(s.windows.projects.open).toBe(false);
  expect(s.windows.projects.maximized).toBe(false); // reset
  expect(s.focused).toBe('about'); // next topmost visible
});

// ---------------------------------------------------------------------------
// minimize
// ---------------------------------------------------------------------------

test('minimize keeps the window open but hidden and moves focus to the next topmost', () => {
  let s = initialState(null); // about z=1, projects z=2, focused=projects
  s = reduce(s, { type: 'minimize', id: 'projects' });
  expect(s.windows.projects.open).toBe(true); // still open
  expect(s.windows.projects.minimized).toBe(true);
  expect(s.focused).toBe('about'); // next topmost visible (z=1)
});

// ---------------------------------------------------------------------------
// no-ops
// ---------------------------------------------------------------------------

test('no-op actions return the same state reference', () => {
  const s = initialState(null); // about z=1, projects z=2 (focused), nextZ=3
  // Close a window that is already closed
  expect(reduce(s, { type: 'close', id: 'activity' })).toBe(s);
  // Focus the already-focused top window
  expect(reduce(s, { type: 'focus', id: 'projects' })).toBe(s);
  // Minimize an already-minimized window
  const s2 = reduce(s, { type: 'minimize', id: 'about' });
  expect(reduce(s2, { type: 'minimize', id: 'about' })).toBe(s2);
});

// ---------------------------------------------------------------------------
// clampRect
// ---------------------------------------------------------------------------

test('clampRect keeps the titlebar inside the bounds and at least 64 px visible horizontally', () => {
  expect(clampRect({ x: -900, y: -40, w: 400, h: 300 }, { w: 1280, h: 680 }, { w: 300, h: 200 })).toEqual({
    x: -336,
    y: 0,
    w: 400,
    h: 300,
  });
  expect(clampRect({ x: 1250, y: 700, w: 400, h: 300 }, { w: 1280, h: 680 }, { w: 300, h: 200 })).toEqual({
    x: 1216,
    y: 650,
    w: 400,
    h: 300,
  });
});

test('clampRect enforces the minimum and caps at the bounds', () => {
  // Too small: enforce minimum
  const small = clampRect({ x: 0, y: 0, w: 100, h: 100 }, { w: 1280, h: 720 }, { w: 300, h: 200 });
  expect(small.w).toBe(300);
  expect(small.h).toBe(200);

  // Too large: cap at bounds
  const big = clampRect({ x: 0, y: 0, w: 2000, h: 2000 }, { w: 1280, h: 720 }, { w: 300, h: 200 });
  expect(big.w).toBe(1280);
  expect(big.h).toBe(720);
});

// ---------------------------------------------------------------------------
// reclamp
// ---------------------------------------------------------------------------

test('reclamp moves every window back into a smaller desktop', () => {
  let s = initialState(null);
  // Give projects a rect that is outside the smaller bounds
  s = reduce(s, {
    type: 'setRect',
    id: 'projects',
    rect: { x: 1200, y: 700, w: 400, h: 300 },
    bounds: { w: 1280, h: 720 },
  });
  // Reclamp to 800×600
  s = reduce(s, { type: 'reclamp', bounds: { w: 800, h: 600 } });
  expect(s.windows.projects.rect).toEqual({ x: 736, y: 570, w: 400, h: 300 });
});

// ---------------------------------------------------------------------------
// arrange / cascade
// ---------------------------------------------------------------------------

test('arrange cascades open windows from (112,24) in z order, skipping the 104px icon column', () => {
  let s = initialState(null); // about z=1, projects z=2
  const bounds = { w: 1280, h: 720 };
  s = reduce(s, { type: 'arrange', bounds });

  const aboutApp = getApp('about')!;
  const { w: aw, h: ah } = fracToRect(aboutApp.defaultRect, bounds);
  // R8: icon column is 104px + 8px gap = 112px x offset
  expect(s.windows.about.rect).toEqual({ x: 112, y: 24, w: aw, h: ah });

  const projectsApp = getApp('projects')!;
  const { w: pw, h: ph } = fracToRect(projectsApp.defaultRect, bounds);
  expect(s.windows.projects.rect).toEqual({ x: 144, y: 56, w: pw, h: ph });
});

// ---------------------------------------------------------------------------
// phone
// ---------------------------------------------------------------------------

test('phoneOpen sets phoneActive without touching desktop windows; phoneHome clears it', () => {
  let s = initialState(null);
  expect(s.phoneActive).toBeNull();

  s = reduce(s, { type: 'phoneOpen', id: 'questday' });
  expect(s.phoneActive).toBe('questday');
  expect(s.windows.questday.open).toBe(false); // desktop untouched
  expect(s.focused).toBe('projects'); // unchanged

  s = reduce(s, { type: 'phoneHome' });
  expect(s.phoneActive).toBeNull();
});

// ---------------------------------------------------------------------------
// hydrate
// ---------------------------------------------------------------------------

test('hydrate restores rects and open state but never reopens a case window the route does not show', () => {
  const s = initialState(null); // no route, case windows closed
  const saved: SavedWindows = {
    contact: { open: true, minimized: false, maximized: false, rect: { x: 100, y: 100, w: 400, h: 300 } },
    questday: { open: true, minimized: false, maximized: false, rect: { x: 50, y: 50, w: 800, h: 600 } }, // should NOT be opened
  };
  const hydrated = reduce(s, { type: 'hydrate', saved });
  expect(hydrated.windows.contact.open).toBe(true);
  expect(hydrated.windows.contact.rect).toEqual({ x: 100, y: 100, w: 400, h: 300 });
  expect(hydrated.windows.questday.open).toBe(false); // never opened — not routed
});

// Carried item 1: hydrate must give opened non-case windows non-zero z values.
test('hydrate assigns non-zero z to opened non-case windows and raises nextZ', () => {
  const s = initialState(null); // about z=1, projects z=2, nextZ=3
  const saved: SavedWindows = {
    contact: { open: true, minimized: false, maximized: false, rect: null },
  };
  const h = reduce(s, { type: 'hydrate', saved });
  expect(h.windows.contact.open).toBe(true);
  expect(h.windows.contact.z).toBeGreaterThan(0);
  expect(h.nextZ).toBeGreaterThan(h.windows.contact.z);
  // initialState windows keep their z
  expect(h.windows.about.z).toBe(1);
  expect(h.windows.projects.z).toBe(2);
});

// Carried item (Task 8): close must clear phoneActive when the closed window is the active phone app.
test('close clears phoneActive when the closed window is the phone active app', () => {
  let s = initialState(null);
  s = reduce(s, { type: 'open', id: 'activity' });
  s = reduce(s, { type: 'phoneOpen', id: 'activity' });
  expect(s.phoneActive).toBe('activity');
  s = reduce(s, { type: 'close', id: 'activity' });
  expect(s.phoneActive).toBeNull();
});

test('close does not clear phoneActive when a different window is closed', () => {
  let s = initialState(null);
  s = reduce(s, { type: 'open', id: 'business' });
  s = reduce(s, { type: 'phoneOpen', id: 'business' });
  s = reduce(s, { type: 'open', id: 'contact' });
  s = reduce(s, { type: 'close', id: 'contact' });
  expect(s.phoneActive).toBe('business');
});

// Carried item 2: arrange must clamp cascaded rects to the given bounds.
test('arrange clamps cascaded rects to small desktop bounds', () => {
  let s = initialState(null); // about, projects open
  // Open more windows so cascade overflows a tiny desktop
  for (const id of ['activity', 'business', 'contact', 'system'] as AppId[]) {
    s = reduce(s, { type: 'open', id });
  }
  // 400 × 200 — cascade index 5 gives y = 24 + 5 × 32 = 184 > 200 − 30 = 170
  const bounds = { w: 400, h: 200 };
  s = reduce(s, { type: 'arrange', bounds });
  for (const id of visibleOrder(s)) {
    const rect = s.windows[id].rect!;
    expect(rect.y, `${id}.y`).toBeLessThanOrEqual(bounds.h - TITLEBAR_H);
    expect(rect.x, `${id}.x`).toBeGreaterThanOrEqual(-(rect.w - MIN_VISIBLE_X));
    expect(rect.x, `${id}.x`).toBeLessThanOrEqual(bounds.w - MIN_VISIBLE_X);
  }
});
