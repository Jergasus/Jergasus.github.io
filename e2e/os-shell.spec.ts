import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { DESKTOP_ICON_ORDER, type AppId, type CaseAppId } from '@/os/apps';
import { bringToFront, expect, openFromIcon, openFromStart, test, visit, win } from './fixtures';

// The OS shell on a desktop (Desktop Chrome, 1280 x 720): windows open,
// close, minimise and maximise from their buttons; project windows own the
// URL; without JavaScript (and in print) every window reads as a document.

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
type Decision = { title: string };
type Messages = {
  meta: { title: string };
  caseStudies: Record<'questday' | 'sakurai' | 'rallyVoley', { decisions: Decision[] }>;
};
const es = readJson<Messages>('../messages/es.json');

const CONTENT_WINDOWS: AppId[] = ['welcome', 'about', 'projects', 'yokaido', 'activity', 'business', 'contact', 'system'];
const CLOSED_ON_LOAD: AppId[] = ['about', 'projects', 'activity', 'business', 'contact', 'system', 'yokaido'];

/** Opens a project from the projects window, opening projects first if it is not open. */
async function openProject(page: Page, slug: CaseAppId) {
  if ((await win(page, 'projects').getAttribute('data-win-state')) !== 'open') {
    await openFromIcon(page, 'projects');
    await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');
  }
  const item = win(page, 'projects').locator(`[data-open-app="${slug}"]`);
  if ((await win(page, 'projects').getAttribute('data-focused')) !== 'true') {
    await bringToFront(page, 'projects');
  }
  await item.click();
  await expect(page).toHaveURL(`/work/${slug}/`);
  await expect(win(page, slug)).toHaveAttribute('data-win-state', 'open');
}

const zIndex = (page: Page, id: AppId) =>
  win(page, id).evaluate((element) => Number(getComputedStyle(element).zIndex));

/** Visible windows in document order. */
const visibleWindows = (page: Page) =>
  page
    .locator('[data-app]')
    .evaluateAll((sections) =>
      sections.filter((section) => section.getClientRects().length > 0).map((section) => section.getAttribute('data-app')),
    );

test('home opens welcome; welcome is focused', async ({ page }) => {
  await visit(page, '/');
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'welcome')).toHaveAttribute('data-focused', 'true');
  await expect(win(page, 'welcome')).toBeVisible();
  for (const id of CLOSED_ON_LOAD) {
    await expect(win(page, id), id).toHaveAttribute('data-win-state', 'closed');
    await expect(win(page, id), id).toBeHidden();
  }
});

test('html gets data-os=desktop before hydration finishes', async ({ page }) => {
  // No script chunk loads, so React never hydrates: only the inline
  // pre-paint script in <head> can have set the attribute.
  await page.route(/\/_next\/static\/.+\.js(\?.*)?$/, (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-os', 'desktop');
  await expect(html).toHaveAttribute('data-wallpaper', 'dots');
  await expect(html).not.toHaveAttribute('data-os-ready', /.*/);
  // The windows are laid out as a desktop from the first paint.
  await expect(win(page, 'activity')).toBeHidden();
  await expect(win(page, 'welcome')).toBeVisible();
});

test('close, minimise and maximise buttons change data-win-state / data-maximized', async ({ page }) => {
  await visit(page, '/');
  // about and projects are closed on home load; open them before interacting.
  await openFromIcon(page, 'about');
  await openFromIcon(page, 'projects');
  const about = win(page, 'about');

  await about.locator('[data-win-maximize]').click();
  await expect(about).toHaveAttribute('data-maximized', 'true');
  await expect(about.locator('[data-win-maximize]')).toHaveAccessibleName('Restaurar');
  const box = (await about.boundingBox())!;
  expect(box.width).toBeGreaterThan(1200);
  await about.locator('[data-win-maximize]').click();
  await expect(about).toHaveAttribute('data-maximized', 'false');
  await expect(about.locator('[data-win-maximize]')).toHaveAccessibleName('Maximizar');

  await about.locator('[data-win-minimize]').click();
  await expect(about).toHaveAttribute('data-win-state', 'minimized');
  await expect(about).toBeHidden();

  const projects = win(page, 'projects');
  await projects.locator('[data-win-close]').click();
  await expect(projects).toHaveAttribute('data-win-state', 'closed');
  await expect(projects).toBeHidden();
});

test('opening a project from the projects window navigates to /work/<slug>/ and shows its window', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  const questday = win(page, 'questday');
  await expect(questday).toBeVisible();
  await expect(questday).toHaveAttribute('data-focused', 'true');
  await expect(questday.getByRole('heading', { level: 1 })).toHaveText('QuestDay');
  // Focus moves into the window it opened.
  await expect(questday).toBeFocused();
  // Its title bar names it.
  await expect(questday).toHaveRole('region');
  await expect(questday).toHaveAccessibleName('QuestDay');
});

test('project windows keep the language in the URL', async ({ page }) => {
  await visit(page, '/en/');
  await openFromIcon(page, 'projects');
  await win(page, 'projects').locator('[data-open-app="rally-voley"]').click();
  await expect(page).toHaveURL('/en/work/rally-voley/');
  await expect(win(page, 'rally-voley').getByRole('heading', { level: 1 })).toHaveText('Rally Voley');
  await win(page, 'rally-voley').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/en/');
});

test('closing the only case window returns to / and keeps other windows as they were', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await win(page, 'questday').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/');
  await expect(win(page, 'questday')).toHaveCount(0);
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');
  // Focus goes back to what opened the window.
  await expect(win(page, 'projects').locator('[data-open-app="questday"]')).toBeFocused();
});

test('opening a second project keeps the first open behind; the URL names the front project', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  await expect(page).toHaveURL('/work/sakurai/');
  await expect(win(page, 'questday')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'questday')).toBeVisible();
  await expect(win(page, 'sakurai')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'sakurai')).toBeGreaterThan(await zIndex(page, 'questday'));
  // Never the same window twice.
  await expect(win(page, 'questday')).toHaveCount(1);
  await expect(win(page, 'sakurai')).toHaveCount(1);
  // One page title: the front project's.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SakurAI');
});

// Ruling R15 (spec §7): bringing an open project forward pushes its URL, so
// Back brings the previous project to the front.
test('clicking the background project window brings it forward and pushes the URL; Back brings the previous project to the front', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  const length = await page.evaluate(() => history.length);

  // Its title bar shows above the project in front, which sits a step lower.
  await win(page, 'questday').locator('[data-titlebar]').click({ position: { x: 12, y: 10 } });
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'questday')).toBeGreaterThan(await zIndex(page, 'sakurai'));
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
  await expect(win(page, 'sakurai')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'questday')).toHaveCount(1);
  await expect(win(page, 'sakurai')).toHaveCount(1);

  // The window already named by the URL adds nothing.
  await win(page, 'questday').locator('a').first().focus();
  await expect(page).toHaveURL('/work/questday/');
  expect(await page.evaluate(() => history.length)).toBe(length + 1);

  await page.goBack();
  await expect(page).toHaveURL('/work/sakurai/');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'sakurai')).toBeGreaterThan(await zIndex(page, 'questday'));
  await expect(win(page, 'questday')).toHaveAttribute('data-win-state', 'open');
});

test('the taskbar brings a background project forward and pushes its URL; Back undoes it', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  const length = await page.evaluate(() => history.length);

  await page.locator('[data-taskbar] [data-task="questday"]').click();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  expect(await page.evaluate(() => history.length)).toBe(length + 1);

  await page.goBack();
  await expect(page).toHaveURL('/work/sakurai/');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-focused', 'true');
});

// What a screen reader sends when it activates a button: a click with no
// pointer behind it (detail 0), and Enter on the keyboard.
test('a desktop icon opens on a click with no pointer behind it, and once', async ({ page }) => {
  await visit(page, '/');
  await page.locator('[data-icon="contact"]').evaluate((icon: HTMLElement) => icon.click());
  await expect(win(page, 'contact')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'contact')).toBeFocused();

  // Keyboard: one open, one history entry for a project.
  const length = await page.evaluate(() => history.length);
  await page.locator('[data-icon="questday"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-win-state', 'open');
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
});

test('a mouse click on a desktop icon selects it, a double click opens it', async ({ page }) => {
  await visit(page, '/');
  const icon = page.locator('[data-icon="activity"]');
  await icon.click();
  await expect(icon).toHaveClass(/os-icon--selected/);
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'closed');
  await icon.dblclick();
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');
});

test('a link inside a background project window works on the first click', async ({ page, context }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  // Out of the way, but still the project the URL names.
  await win(page, 'sakurai').locator('[data-win-minimize]').click();
  await expect(page).toHaveURL('/work/sakurai/');

  const visitLink = win(page, 'questday').getByRole('link', { name: /visitar/i });
  // Scroll it into view inside its window without focusing (or raising) it.
  await visitLink.evaluate((link) => link.scrollIntoView({ block: 'center' }));
  // The live site itself stays off the network.
  await context.route('https://playquestday.com/**', (route) => route.fulfill({ body: 'QuestDay' }));
  const popup = context.waitForEvent('page');
  await visitLink.click();
  await (await popup).waitForURL(/playquestday\.com/);
  // The click brought the window forward too, and the URL followed.
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
});

test('keyboard focus inside a background project window stays there when it comes forward', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  const visitLink = win(page, 'questday').getByRole('link', { name: /visitar/i });
  await visitLink.focus();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  await expect(visitLink).toBeFocused();
});

test('closing the front project moves the URL to the other open project, then to / when none is left', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');

  await win(page, 'sakurai').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'sakurai')).toHaveCount(0);
  await expect(win(page, 'questday')).toHaveAttribute('data-win-state', 'open');

  await win(page, 'questday').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/');
  await expect(win(page, 'questday')).toHaveCount(0);
});

test('back and forward follow the active project window', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');

  await page.goBack();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'questday')).toBeGreaterThan(await zIndex(page, 'sakurai'));
  await expect(win(page, 'sakurai')).toHaveAttribute('data-win-state', 'open');

  await page.goForward();
  await expect(page).toHaveURL('/work/sakurai/');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'sakurai')).toBeGreaterThan(await zIndex(page, 'questday'));

  // After closing the front project, back brings it back to the front.
  await win(page, 'sakurai').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/work/questday/');
  await page.goBack();
  await expect(page).toHaveURL('/work/sakurai/');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-focused', 'true');
  await expect(win(page, 'questday')).toHaveCount(1);
  await expect(win(page, 'sakurai')).toHaveCount(1);
});

// Ruling R7: home means no project windows.
test('back to / after opening a project closes it and keeps home in history', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(win(page, 'questday')).toHaveCount(0);
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');

  await page.goForward();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'questday')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(win(page, 'questday')).toHaveCount(0);
});

test('/ → questday → sakurai, back twice', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');

  await page.goBack();
  await expect(page).toHaveURL('/work/questday/');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'questday')).toBeGreaterThan(await zIndex(page, 'sakurai'));
  await expect(win(page, 'sakurai')).toHaveAttribute('data-win-state', 'open');

  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-app="questday"], [data-app="sakurai"], [data-app="rally-voley"]')).toHaveCount(0);
  // Nothing left to touch that could rewrite home's history entry.
  const length = await page.evaluate(() => history.length);
  await win(page, 'welcome').locator('[data-titlebar]').click({ position: { x: 12, y: 10 } });
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => history.length)).toBe(length);
});

test('reload on a project page keeps it in front of the windows the session reopens', async ({ page }) => {
  await visit(page, '/work/questday/');
  await openFromStart(page, 'terminal');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('jgos-windows'))).toContain('"terminal":{"open":true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
  await expect(win(page, 'terminal')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'questday')).toHaveAttribute('data-focused', 'true');
  expect(await zIndex(page, 'questday')).toBeGreaterThan(await zIndex(page, 'terminal'));
});

test('reload on /work/sakurai/ after opening two projects shows only sakurai', async ({ page }) => {
  await visit(page, '/');
  await openProject(page, 'questday');
  await openProject(page, 'sakurai');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
  await expect(win(page, 'sakurai')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'questday')).toHaveCount(0);
  await expect(win(page, 'rally-voley')).toHaveCount(0);
});

test('a case page HTML still contains only its own case study copy', async ({ page }) => {
  await page.goto('/work/sakurai/');
  const html = await page.content();
  expect(html).toContain(es.caseStudies.sakurai.decisions[0].title);
  expect(html).not.toContain(es.caseStudies.questday.decisions[0].title);
  expect(html).not.toContain(es.caseStudies.rallyVoley.decisions[0].title);
});

test('loading /work/sakurai/ directly opens sakurai focused on top', async ({ page }) => {
  await visit(page, '/work/sakurai/');
  const sakurai = win(page, 'sakurai');
  await expect(sakurai).toBeVisible();
  await expect(sakurai).toHaveAttribute('data-focused', 'true');
  // On a case route, only the case window opens; about and projects are closed.
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'closed');
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'closed');
});

test('exactly one h1 on home and on a case page', async ({ page }) => {
  await visit(page, '/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(es.meta.title);
  await visit(page, '/work/questday/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('QuestDay');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every content window is readable in order and chrome is hidden', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-os', /.*/);
    await expect(page.locator('h1')).toBeVisible();
    expect(await visibleWindows(page)).toEqual(CONTENT_WINDOWS);
    // Stacked as a document: each visible window starts below the one before.
    // (interactive-only windows like settings, terminal etc. are display:none and excluded.)
    const tops = await page
      .locator('[data-app]')
      .evaluateAll((sections) =>
        sections
          .filter((s) => s.getClientRects().length > 0)
          .map((s) => s.getBoundingClientRect().top),
      );
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    // The phone home screen is OS chrome too: its icons are buttons that need
    // JavaScript, and the document already carries everything it shows.
    for (const selector of ['[data-desktop]', '[data-taskbar]', '[data-phone-home]', '[data-dock]', '[data-win-close]', '[data-win-minimize]', '[data-win-maximize]']) {
      for (const element of await page.locator(selector).all()) await expect(element, selector).toBeHidden();
    }

    await page.goto('/work/rally-voley/');
    expect(await visibleWindows(page)).toEqual(['rally-voley', ...CONTENT_WINDOWS]);
  });
});

test('print media shows the document layout with every content window', async ({ page }) => {
  await visit(page, '/');
  await page.emulateMedia({ media: 'print' });
  expect(await visibleWindows(page)).toEqual(CONTENT_WINDOWS);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-taskbar]')).toBeHidden();
  await expect(page.locator('[data-desktop]')).toBeHidden();
  await expect(page.locator('[data-phone-home]')).toBeHidden();
});

test('Personalizar opens the settings window from its desktop icon', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'settings');
  await expect(win(page, 'settings')).toHaveAttribute('data-win-state', 'open');
});

// Every desktop icon must stay on screen and not be covered by a window, at
// all supported viewport heights. At ≤ 75rem height the column doubles.
for (const viewport of [
  { width: 1024, height: 640 },
  { width: 1280, height: 720 },
  { width: 1366, height: 657 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1920, height: 1200 },
  { width: 1920, height: 1201 },
  { width: 2560, height: 1440 },
]) {
  test(`every desktop icon is fully on screen and uncovered at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page, '/');
    await page.evaluate(() => document.fonts.ready);
    const desk = (await page.locator('[data-desktop]').boundingBox())!;
    const icons = page.locator('[data-icon]');
    await expect(icons).toHaveCount(DESKTOP_ICON_ORDER.length);
    // Open Sobre mí so ordinary windows (placed by --os-win-min-x) are covered too.
    await openFromIcon(page, 'about');
    await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
    const windows = await Promise.all(['welcome', 'about'].map(async (id) => (await win(page, id as AppId).boundingBox())!));
    for (const icon of await icons.all()) {
      const name = (await icon.getAttribute('data-icon'))!;
      const box = (await icon.boundingBox())!;
      expect(box.y, name).toBeGreaterThanOrEqual(desk.y);
      expect(box.x, name).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height, name).toBeLessThanOrEqual(desk.y + desk.height);
      expect(box.x + box.width, name).toBeLessThanOrEqual(viewport.width);
      for (const frame of windows) {
        const apart =
          box.x + box.width <= frame.x || frame.x + frame.width <= box.x || box.y + box.height <= frame.y || frame.y + frame.height <= box.y;
        expect(apart, `${name} is under a window`).toBe(true);
      }
    }
    // 1200 px is the 75rem breakpoint: above it one column, at or below two.
    const xs = await icons.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().x)));
    expect(new Set(xs).size, 'icon columns').toBe(viewport.height > 1200 ? 1 : 2);
    // Nothing to scroll in the icon area.
    const column = page.locator('.os-icon-col');
    expect(await column.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);
    // The centred welcome window starts to the right of the icon column's right edge.
    const colBox = (await column.boundingBox())!;
    const welcomeBox = windows[0]; // welcome is the first entry in the windows array above
    expect(welcomeBox.x, 'welcome.x >= icon column right edge').toBeGreaterThanOrEqual(colBox.x + colBox.width - 2);
  });
}

// Icon names sit straight on the wallpaper, with no chip behind them: light
// text with a dark pixel outline, and dark text on the one light wallpaper.
for (const [layout, viewport, label] of [
  ['desktop', { width: 1440, height: 900 }, '[data-icon] .os-icon-label'],
  ['phone', { width: 390, height: 844 }, '.os-phone-icon-label'],
] as const) {
  test(`${layout} icon names have no chip and follow the wallpaper`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page, '/');
    const look = () =>
      page.locator(label).first().evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color, outline: style.textShadow };
      });

    const onDots = await look();
    expect(onDots.background).toBe('rgba(0, 0, 0, 0)');
    expect(onDots.color).toBe('rgb(255, 255, 255)');
    expect(onDots.outline).toContain('rgb(17, 17, 17)');

    await page.evaluate(() => document.documentElement.setAttribute('data-wallpaper', 'cream'));
    const onCream = await look();
    expect(onCream.color).toBe('rgb(17, 17, 17)');
    expect(onCream.outline).not.toContain('rgb(17, 17, 17)');
  });
}

// A one-word label never breaks mid-word in any language: "Personalitzar"
// is the longest. Labels with a space may wrap between words.
for (const path of ['/', '/ca/', '/en/']) {
  test(`one-word desktop icon labels stay on one line (${path})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await visit(page, path);
    await page.evaluate(() => document.fonts.ready);
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-icon] .os-icon-label')]
        .filter((label) => !label.textContent!.trim().includes(' '))
        .filter((label) => label.getClientRects().length > 1 || label.getBoundingClientRect().height > 1.6 * parseFloat(getComputedStyle(label).lineHeight))
        .map((label) => label.textContent!.trim()),
    );
    expect(broken).toEqual([]);
  });
}

// Every project has its own desktop icon, so closing a deep-linked project
// focuses that project's own icon.
test('closing a deep-linked project with nothing else open focuses its own desktop icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, '/work/questday/');
  // On a deep link only questday is open and focused; there is no opener stored for it.
  await win(page, 'questday').locator('[data-win-close]').click();
  await expect(page).toHaveURL('/');
  // The questday desktop icon must receive focus.
  const questdayIcon = page.locator('[data-icon="questday"]');
  await expect(questdayIcon).toBeFocused();
});

// When another window is in front, closing a window that was opened without an
// explicit opener (e.g. from the terminal) should focus that front window, not
// the closed window's desktop icon.
test('closing a window opened by the terminal focuses the terminal, not the closed window\'s icon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visit(page, '/');
  // Open terminal and type "abrir sobre" to open Sobre mí from the terminal.
  // The terminal does not pass an opener element, so the openers map has no entry.
  await openFromStart(page, 'terminal');
  await expect(win(page, 'terminal')).toHaveAttribute('data-win-state', 'open');
  const termInput = win(page, 'terminal').getByRole('textbox');
  await termInput.fill('abrir sobre');
  await termInput.press('Enter');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'about')).toHaveAttribute('data-focused', 'true');

  // Close Sobre mí; with no opener stored for it, focus must land on the
  // terminal (the topmost remaining visible window), not on the Sobre mí icon.
  await win(page, 'about').locator('[data-win-close]').click();
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'closed');
  await expect(win(page, 'terminal')).toHaveAttribute('data-focused', 'true');
  // Keyboard focus must be inside the terminal or on its frame, not on the icon.
  await expect(page.locator('[data-icon="about"]')).not.toBeFocused();
});

// F6: after a reload, the taskbar button of the front window minimises it,
// and the back window's button raises it (stale-focus fix).
test('after a reload, the front window taskbar minimises it and the back one raises it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Open contact (non-case, opens on top of welcome).
  await visit(page, '/');
  await openFromStart(page, 'contact');
  await expect(win(page, 'contact')).toHaveAttribute('data-focused', 'true');

  // Persist the state, then reload.
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('jgos-windows'))).toContain('"contact":{"open":true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

  // After reload, contact is the topmost visible window → it must be focused.
  await expect(win(page, 'contact')).toHaveAttribute('data-focused', 'true');

  // welcome is behind and NOT focused → clicking its taskbar RAISES it, does not minimise it.
  const welcomeTask = page.locator('[data-taskbar] [data-task="welcome"]');
  await expect(welcomeTask).not.toHaveAttribute('aria-pressed', 'true');
  await welcomeTask.click();
  // welcome raised: now focused, still open.
  await expect(win(page, 'welcome')).toHaveAttribute('data-focused', 'true');
  await expect(win(page, 'welcome')).toHaveAttribute('data-win-state', 'open');

  // contact is now behind — clicking its taskbar RAISES it (not minimises it).
  const contactTask = page.locator('[data-taskbar] [data-task="contact"]');
  await expect(contactTask).not.toHaveAttribute('aria-pressed', 'true');
  await contactTask.click();
  await expect(win(page, 'contact')).toHaveAttribute('data-focused', 'true');
  await expect(win(page, 'contact')).toHaveAttribute('data-win-state', 'open');
});
