import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { AppId, CaseAppId } from '@/os/apps';
import { bringToFront, expect, test, visit, win } from './fixtures';

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

const CONTENT_WINDOWS: AppId[] = ['about', 'projects', 'yokaido', 'activity', 'business', 'contact', 'system'];
const CLOSED_ON_LOAD: AppId[] = ['activity', 'business', 'contact', 'system', 'yokaido'];

/** Opens a project from the projects window, raising that window first if a project covers it. */
async function openProject(page: Page, slug: CaseAppId) {
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

test('home opens about and projects; projects is focused', async ({ page }) => {
  await visit(page, '/');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'about')).toHaveAttribute('data-focused', 'false');
  await expect(win(page, 'projects')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'projects')).toHaveAttribute('data-focused', 'true');
  await expect(win(page, 'about')).toBeVisible();
  await expect(win(page, 'projects')).toBeVisible();
  for (const id of CLOSED_ON_LOAD) {
    await expect(win(page, id), id).toHaveAttribute('data-win-state', 'closed');
    await expect(win(page, id), id).toBeHidden();
  }
  expect(await zIndex(page, 'projects')).toBeGreaterThan(await zIndex(page, 'about'));
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
  await expect(win(page, 'about')).toBeVisible();
});

test('close, minimise and maximise buttons change data-win-state / data-maximized', async ({ page }) => {
  await visit(page, '/');
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
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
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
  await win(page, 'projects').locator('[data-titlebar]').click({ position: { x: 12, y: 10 } });
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => history.length)).toBe(length);
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
  for (const id of ['about', 'projects'] as const) {
    await expect(win(page, id)).toHaveAttribute('data-win-state', 'open');
    expect(await zIndex(page, 'sakurai')).toBeGreaterThan(await zIndex(page, id));
  }
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
    // (interactiveOnly windows like settings are display:none and excluded.)
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

// Carried item (Task 14): on a laptop screen the eleven desktop icons flow
// into a second column instead of hiding below the fold, and the windows
// open on load start clear of them.
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
]) {
  test(`every desktop icon is fully on screen and uncovered at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await visit(page, '/');
    await page.evaluate(() => document.fonts.ready);
    const desk = (await page.locator('[data-desktop]').boundingBox())!;
    const icons = page.locator('[data-icon]');
    await expect(icons).toHaveCount(11);
    const windows = await Promise.all(['about', 'projects'].map(async (id) => (await win(page, id as AppId).boundingBox())!));
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
    // Nothing to scroll in the icon area.
    const column = page.locator('.os-icon-col');
    expect(await column.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(0);
  });
}
