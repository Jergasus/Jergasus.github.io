import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Locale } from '@/i18n/routing';
import type { Status } from '@/lib/status';
import { expect, test, visit, win, openFromIcon, taskbar } from './fixtures';
import { SKIP_BOOT_FLAG } from '@/os/prepaint';

// ---------------------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------------------

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

type Messages = {
  hero: { lede: string; availability: { available: string; unavailable: string } };
  about: { photoAlt: string; bio: string };
  contact: { heading: string };
  os: { apps: { about: { label: string }; projects: { label: string }; welcome: { title: string; label: string } } };
  projects: {
    questday: { oneLiner: string };
    sakurai: { oneLiner: string };
    rallyVoley: { oneLiner: string };
  };
  work: { status: Record<'live' | 'building' | 'wip', string> };
  welcome: { question: string; seeProjects: string; explore: string };
};

const messages = (locale: Locale) => readJson<Messages>(`../messages/${locale}.json`);
const status = readJson<Status>('../content/status.json');
const es = messages('es');

const LOCALES: { locale: Locale; path: string; prefix: string }[] = [
  { locale: 'es', path: '/', prefix: '' },
  { locale: 'ca', path: '/ca/', prefix: '/ca' },
  { locale: 'en', path: '/en/', prefix: '/en' },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('home opens only the welcome, in front', async ({ page }) => {
  await visit(page, '/');
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'welcome')).toHaveAttribute('data-focused', 'true');
  for (const id of ['about', 'projects'] as const) {
    await expect(win(page, id)).toHaveAttribute('data-win-state', 'closed');
  }
  await expect(taskbar(page).locator('[data-task]')).toHaveCount(1);
});

for (const { locale, path } of LOCALES) {
  test(`the welcome is a short guide: who, one line, a question and three ways in (${locale})`, async ({ page }) => {
    await visit(page, path);
    const m = messages(locale);
    const avail = status.availabilityLabel?.[locale] ??
      m.hero.availability[status.available ? 'available' : 'unavailable'];
    const welcome = win(page, 'welcome');

    // Identity: portrait, name, availability
    await expect(welcome.getByRole('heading', { level: 2 })).toHaveText('Jesús García');
    await expect(welcome).toContainText(avail);

    // Line
    await expect(welcome.locator('[data-welcome-part="line"]')).toHaveText(m.hero.lede);
    // Question
    await expect(welcome.getByRole('heading', { level: 3 })).toHaveText(m.welcome.question);
    // Three ways in
    const ways = welcome.locator('[data-welcome-part="actions"] button');
    await expect(ways).toHaveText([m.welcome.seeProjects, m.os.apps.about.label, m.contact.heading]);
    expect(await ways.evaluateAll((els) => els.map((el) => el.getAttribute('data-open-app')))).toEqual(['projects', 'about', 'contact']);
    await expect(welcome.locator('a[data-open-app]')).toHaveCount(0);
    // No bio
    await expect(welcome).not.toContainText(m.about.bio);
    // Explore line visible on desktop
    await expect(welcome.locator('[data-shell="desktop"]')).toHaveText(m.welcome.explore);
    await expect(welcome.locator('[data-shell="desktop"]')).toBeVisible();
    // DOM order of welcome parts
    expect(await welcome.locator('[data-welcome-part]').evaluateAll((els) => els.map((el) => el.getAttribute('data-welcome-part'))))
      .toEqual(['identity', 'line', 'question', 'actions', 'explore']);
  });
}

test('the guide copy matches the spec (es)', async () => {
  expect([es.hero.lede, es.welcome.question, es.welcome.seeProjects, es.welcome.explore])
    .toEqual(['Desarrollador full-stack en Barcelona.', '¿Por dónde empiezas?', 'Ver proyectos', 'Cierra esta ventana para explorar JG-OS ↓']);
});

for (const id of ['projects', 'about', 'contact'] as const) {
  test(`each way in opens its app in front, and closing it brings focus back to the button (${id})`, async ({ page }) => {
    await visit(page, '/');
    const welcome = win(page, 'welcome');
    const btn = welcome.locator(`[data-welcome-part="actions"] button[data-open-app="${id}"]`);
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(win(page, id)).toHaveAttribute('data-win-state', 'open');
    await expect(win(page, id)).toHaveAttribute('data-focused', 'true');
    await win(page, id).locator('[data-win-close]').click();
    await expect(btn).toBeFocused();
    await expect(welcome).toHaveAttribute('data-win-state', 'open');
  });
}

// ---------------------------------------------------------------------------
// Titlebar colour tests
// ---------------------------------------------------------------------------

for (const theme of [undefined, 'dark'] as const) {
  test(`welcome titlebar is grey (#5c6069) with beige title text in ${theme ?? 'light'} theme`, async ({ page }) => {
    await visit(page, '/');
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }
    const titlebar = win(page, 'welcome').locator('.os-titlebar');
    await expect(titlebar).toHaveCSS('background-color', 'rgb(92, 96, 105)');
    await expect(win(page, 'welcome').locator('.os-title')).toHaveCSS('color', 'rgb(237, 231, 217)');
  });
}

test('the about window keeps its app colour (not black) after the welcome override', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'about');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
  const aboutTitlebar = win(page, 'about').locator('.os-titlebar');
  // about uses --os-c-lilac (#c9b8ff = rgb(201, 184, 255))
  await expect(aboutTitlebar).toHaveCSS('background-color', 'rgb(201, 184, 255)');
});

test('focused welcome titlebar has the white-stripe pattern (not the dark one)', async ({ page }) => {
  await visit(page, '/');
  // The welcome is focused on first load (data-focused="true").
  const titlebar = win(page, 'welcome').locator('.os-titlebar');
  await expect(win(page, 'welcome')).toHaveAttribute('data-focused', 'true');
  // White stripes: rgb(255 255 255 / 0.1) → rgba(255, 255, 255, 0.1) in computed style.
  await expect(titlebar).toHaveCSS('background-image', /rgba\(255, 255, 255, 0\.1\)/);
});

test('maximise and restore returns the welcome to its centred position with the grey titlebar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, '/');
  const welcome = win(page, 'welcome');

  // Before: CSS-centred (no rect saved yet).
  await expect(welcome).toHaveAttribute('data-centred', '');

  // Maximise.
  await welcome.locator('[data-win-maximize]').click();
  await expect(welcome).toHaveAttribute('data-maximized', 'true');

  // Restore via the same button.
  await welcome.locator('[data-win-maximize]').click();
  await expect(welcome).toHaveAttribute('data-maximized', 'false');

  // Restore returns to the centred position: toggleMaximize never writes a
  // rect, so win.rect is still null and data-centred is restored.
  await expect(welcome).toHaveAttribute('data-centred', '');

  const box = (await welcome.boundingBox())!;

  // Horizontally centred on the screen (1440/2 = 720).
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(2);

  // Not overlapping the icon column.
  const iconsEdge = await page.evaluate(() => {
    const icons = [...document.querySelectorAll<HTMLElement>('[data-icon]')];
    if (icons.length === 0) return 0;
    return Math.max(...icons.map((i) => i.getBoundingClientRect().right)) + 16;
  });
  expect(box.x).toBeGreaterThanOrEqual(iconsEdge - 1);

  // Titlebar still grey after restore.
  await expect(welcome.locator('.os-titlebar')).toHaveCSS('background-color', 'rgb(92, 96, 105)');
});

// ---------------------------------------------------------------------------
// Centring tests (screen-centre, not right-of-icons)
// ---------------------------------------------------------------------------

for (const viewport of [
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`the welcome is short and sits centred on the screen at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page, '/');
    await page.evaluate(() => document.fonts.ready);

    // iconsEdge = max right of [data-icon] + 16 (that is --os-win-min-x)
    const iconsEdge = await page.evaluate(() => {
      const icons = [...document.querySelectorAll<HTMLElement>('[data-icon]')];
      if (icons.length === 0) return 0;
      const maxRight = Math.max(...icons.map((icon) => icon.getBoundingClientRect().right));
      return maxRight + 16;
    });

    const welcome = win(page, 'welcome');
    const box = (await welcome.boundingBox())!;
    const { width } = viewport;

    // Left edge never overlaps the icon column (applies to all viewports)
    expect(box.x).toBeGreaterThanOrEqual(iconsEdge - 1);

    if (viewport.width >= 1440) {
      // Large viewports: horizontal centre equals the screen's horizontal centre
      const winCentreX = box.x + box.width / 2;
      const screenCentreX = width / 2;
      expect(Math.abs(winCentreX - screenCentreX)).toBeLessThanOrEqual(2);
    }

    // data-centred is set while the window has no saved rect
    await expect(welcome).toHaveAttribute('data-centred', '');

    // Vertically centred in the desktop area
    const desk = (await page.locator('[data-desktop]').boundingBox())!;
    const topGap = box.y - desk.y;
    const bottomGap = desk.y + desk.height - (box.y + box.height);
    expect(Math.abs(topGap - bottomGap)).toBeLessThanOrEqual(4);

    // Short: height ≤ 70% of desk height
    expect(box.height).toBeLessThanOrEqual(0.7 * desk.height);

    // No internal scroll
    expect(await welcome.locator('.os-win-body').evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);

    // Explore line is visible
    await expect(welcome.locator('[data-shell="desktop"]')).toBeInViewport();
  });
}

test('at 1024×640 the welcome needs no scrolling: its body is not a tab stop', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 640 });
  await visit(page, '/');
  const welcomeBody = win(page, 'welcome').locator('.os-win-body');
  // No overflow: body has tabindex="-1" and no role
  await expect(welcomeBody).toHaveAttribute('tabindex', '-1');
  await expect(welcomeBody).not.toHaveAttribute('role', /.*/);
});

test('the centred welcome follows a resize from the first move', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await visit(page, '/');
  await page.evaluate(() => document.fonts.ready);
  const welcome = win(page, 'welcome');
  const box = (await welcome.boundingBox())!;
  const handle = welcome.locator('[data-resize="se"]');
  const handleBox = (await handle.boundingBox())!;
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Move +60/+60 in 6 steps without releasing
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(startX + i * 10, startY + i * 10);
  }

  // Poll: width and height have grown by more than 50px; x and y stay within 2px
  await expect.poll(async () => {
    const b = await welcome.boundingBox();
    return b && b.width - box.width > 50 && b.height - box.height > 50;
  }, { timeout: 3000 }).toBe(true);

  const mid = (await welcome.boundingBox())!;
  expect(Math.abs(mid.x - box.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(mid.y - box.y)).toBeLessThanOrEqual(2);

  // Release: data-centred is gone, size stays
  await page.mouse.up();
  await expect(welcome).not.toHaveAttribute('data-centred', /.*/);
  const after = (await welcome.boundingBox())!;
  expect(after.width).toBeGreaterThan(box.width + 40);
  expect(after.height).toBeGreaterThan(box.height + 40);
});

test('on load focus stays on the page, and Tab reaches the welcome before any other window', async ({ page }) => {
  await visit(page, '/');
  // Tab through non-window elements (icons, etc.) until focus lands in a window.
  // The first window to receive focus must be welcome — not about, projects, etc.
  let focused: string | null = null;
  for (let i = 0; i < 25 && focused === null; i++) {
    await page.keyboard.press('Tab');
    focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return el.closest('[data-app]')?.getAttribute('data-app') ?? null;
    });
  }
  expect(focused).toBe('welcome');
});

test('closing the welcome leaves nothing open; a reload keeps it closed; a new tab opens it again', async ({
  page,
  context,
}) => {
  await visit(page, '/');
  await win(page, 'welcome').locator('[data-win-close]').click();
  await expect(page.locator('[data-app][data-win-state="open"]')).toHaveCount(0);

  // sessionStorage persists the closed state
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('jgos-windows')))
    .toContain('"welcome":{"open":false');

  // Reload keeps it closed
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'closed');

  // New tab starts fresh — welcome opens (flag skips the boot in this e2e build)
  const newPage = await context.newPage();
  await newPage.addInitScript((flag) => {
    (window as unknown as Record<string, unknown>)[flag] = true;
  }, SKIP_BOOT_FLAG);
  await newPage.goto('/');
  await expect(newPage.locator('html')).toHaveAttribute('data-os-ready', '1');
  await expect(newPage.locator('[data-app="welcome"]')).toHaveAttribute('data-win-state', 'open');
  await newPage.close();
});

for (const path of ['/work/sakurai/', '/ca/work/questday/', '/en/work/rally-voley/']) {
  test(`a deep link opens its project in front and not the welcome (${path})`, async ({ page }) => {
    await visit(page, path);
    // The welcome is closed on a deep link
    await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'closed');
    // The case study window is open and focused
    const slug = path.split('/work/')[1]?.replace('/', '') as 'sakurai' | 'questday' | 'rally-voley';
    await expect(win(page, slug)).toHaveAttribute('data-win-state', 'open');
    await expect(win(page, slug)).toHaveAttribute('data-focused', 'true');
  });
}

test('Ordenar ventanas cascades the welcome like any other window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await visit(page, '/');
  await openFromIcon(page, 'projects');
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');

  // Get the icon edge
  const edge = await page.evaluate(() => {
    const icons = [...document.querySelectorAll<HTMLElement>('[data-icon]')];
    if (icons.length === 0) return 128;
    return Math.max(...icons.map((icon) => icon.getBoundingClientRect().right)) + 16;
  });

  // Fire contextmenu directly on [data-desktop] — the context-menu handler
  // requires target.closest('[data-desktop]'). Using evaluate bypasses the
  // welcome window (which covers the centre of the screen) overlapping the click.
  await page.evaluate(() => {
    const desktop = document.querySelector('[data-desktop]') as HTMLElement;
    desktop.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 1150, clientY: 400 }));
  });
  await page
    .locator('[data-context-menu]')
    .getByRole('menuitem', { name: /Ordenar ventanas/i })
    .click();

  const welcomeBox = (await win(page, 'welcome').boundingBox())!;
  const projectsBox = (await win(page, 'projects').boundingBox())!;

  // Welcome starts at the edge
  expect(Math.abs(welcomeBox.x - edge)).toBeLessThanOrEqual(4);
  // Projects is 32 px right and 32 px down from welcome
  expect(Math.abs(projectsBox.x - (welcomeBox.x + 32))).toBeLessThanOrEqual(4);
  expect(Math.abs(projectsBox.y - (welcomeBox.y + 32))).toBeLessThanOrEqual(4);
});

for (const mode of ['desktop', 'phone'] as const) {
  test(`the page has no duplicate ids with the welcome in both shells (${mode})`, async ({ page }) => {
    if (mode === 'phone') await page.setViewportSize({ width: 375, height: 667 });
    await visit(page, '/');

    const ids = await page.evaluate(() =>
      [...document.querySelectorAll('[id]')].map((el) => el.id)
    );
    const unique = new Set(ids);
    expect(
      unique.size,
      'duplicate ids: ' + JSON.stringify([...ids].filter((id, i) => ids.indexOf(id) !== i)),
    ).toBe(ids.length);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });
}

// ---------------------------------------------------------------------------
// No-JavaScript document
// ---------------------------------------------------------------------------

/** Visible [data-app] sections in DOM order. */
const visibleApps = (page: Page) =>
  page.locator('[data-app]').evaluateAll((sections) =>
    sections
      .filter((s) => s.getClientRects().length > 0)
      .map((s) => s.getAttribute('data-app')),
  );

/** Content-window ids in the no-JS document order (about is back in the document). */
const DOC = ['welcome', 'about', 'projects', 'yokaido', 'activity', 'business', 'contact', 'system'];

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the document reads the welcome right after the h1, then the other content windows', async ({ page }) => {
    await page.goto('/');
    expect(await visibleApps(page)).toEqual(DOC);
    const h1Box = (await page.locator('h1').boundingBox())!;
    const welcomeBox = (await page.locator('[data-app="welcome"]').boundingBox())!;
    expect(welcomeBox.y).toBeGreaterThan(h1Box.y + h1Box.height - 2);

    await page.goto('/work/rally-voley/');
    expect(await visibleApps(page)).toEqual(['rally-voley', ...DOC]);
  });

  test('nothing in the document says the same thing twice', async ({ page }) => {
    await page.goto('/');
    const text = await page.locator('body').innerText();
    const count = (s: string) => text.split(s).length - 1;
    expect(count(es.about.bio)).toBe(1);
    expect(count(es.hero.lede)).toBe(1);
    for (const key of ['questday', 'sakurai', 'rallyVoley'] as const) {
      expect(count(es.projects[key].oneLiner), key).toBe(1);
    }
    await expect(page.locator('img[src="/about/jesus-garcia.webp"]:visible')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2, name: 'Jesús García', exact: true })).toHaveCount(1);
    await expect(page.locator('[data-welcome-part="explore"]:visible')).toHaveCount(0);
  });

  test('the welcome is an index to Proyectos, Sobre mí and Contacto', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('[data-app="welcome"] [data-welcome-part="actions"] a');
    await expect(links).toHaveText([es.welcome.seeProjects, es.os.apps.about.label, es.contact.heading]);
    expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))).toEqual(['#projects', '#about', '#contact']);
    for (const id of ['projects', 'about', 'contact']) await expect(page.locator(`#${id}`)).toBeVisible();
  });
});

test('print reads the same document', async ({ page }) => {
  await visit(page, '/');
  await page.emulateMedia({ media: 'print' });
  expect(await visibleApps(page)).toEqual(DOC);
});
