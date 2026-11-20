/**
 * Retro browser e2e tests (Task 11).
 *
 * Uses page.route to fulfil or abort project URLs — never makes real network
 * requests to the live sites.
 */
import { expect, test, win, visit } from './fixtures';
import { projects } from '../src/content/projects';

/** Only projects with a live URL. */
const liveProjects = projects.filter((p) => p.liveUrl !== null);
const questday = projects.find((p) => p.slug === 'questday')!;
const questdayUrl = questday.liveUrl!; // https://playquestday.com

/** A URL that is not in projects[].liveUrl. */
const forbiddenUrl = 'https://www.google.com';

/** Stub HTML returned by page.route instead of the real site. */
const STUB_HTML = '<html><head><title>Stub</title></head><body>stub</body></html>';

/** Route the given URL pattern to a stub so the iframe loads without real net. */
async function stubRoute(page: Parameters<typeof win>[0], urlGlob: string) {
  await page.route(urlGlob, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML }),
  );
}

// ── Test 1: no iframe and no request on initial load ─────────────────────────

test('no iframe and no request to the project site before the browser opens', async ({ page }) => {
  const liveOrigins = liveProjects.map((p) => new URL(p.liveUrl!).origin);
  const thirdParty: string[] = [];

  page.on('request', (req) => {
    try {
      const origin = new URL(req.url()).origin;
      if (liveOrigins.includes(origin)) thirdParty.push(req.url());
    } catch {
      // non-URL entries — ignore
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });

  // No iframes should exist in the DOM at all
  await expect(page.locator('iframe')).toHaveCount(0);

  // No network request to any live project origin
  expect(thirdParty, 'no requests to live project sites before browser opens').toEqual([]);
});

// ── Test 2: Abrir en el navegador loads the iframe ───────────────────────────

test('QuestDay window → Abrir en el navegador loads playquestday.com in an iframe', async ({
  page,
}) => {
  await stubRoute(page, `${questdayUrl}/**`);
  // Also stub the root URL itself
  await page.route(questdayUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML }),
  );

  await visit(page, '/work/questday/');

  // Click the "Abrir en el navegador" button inside the QuestDay case window
  await win(page, 'questday')
    .getByRole('button', { name: /abrir en el navegador/i })
    .click();

  // The browser window should now be open
  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'open');

  // An iframe with the QuestDay URL should be inside the browser window
  await expect(
    win(page, 'browser').locator(`iframe[src="${questdayUrl}"]`),
  ).toHaveCount(1);

  // The address bar shows the URL
  await expect(
    win(page, 'browser').locator('[data-browser-address]'),
  ).toContainText('playquestday.com');
});

// ── Test 3: fallback when the site does not load ──────────────────────────────

test('shows the fallback when the site does not load', async ({ page }) => {
  // Abort the iframe's request to simulate a failed load
  await page.route(questdayUrl, (route) => route.abort());
  await page.route(`${questdayUrl}/**`, (route) => route.abort());

  await visit(page, '/work/questday/');

  // Install the fake clock before the click so the 8 s timer is controlled
  await page.clock.install({ time: Date.now() });

  await win(page, 'questday')
    .getByRole('button', { name: /abrir en el navegador/i })
    .click();

  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'open');

  // Skip past the 8 second timeout
  await page.clock.fastForward(9_000);

  // The fallback message should be visible (os.browser.failed)
  await expect(
    win(page, 'browser').locator('[data-browser-failed]'),
  ).toBeVisible();

  // The "Abrir en una pestaña nueva" link in the fallback must be prominent and visible
  await expect(
    win(page, 'browser').locator('[data-browser-failed]').getByRole('link', {
      name: /abrir en una pestaña nueva/i,
    }),
  ).toBeVisible();
});

// ── Test 4: closing the browser removes the iframe ───────────────────────────

test('closing the browser removes the iframe', async ({ page }) => {
  await stubRoute(page, `${questdayUrl}/**`);
  await page.route(questdayUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML }),
  );

  await visit(page, '/work/questday/');

  // Open the browser with the QuestDay URL
  await win(page, 'questday')
    .getByRole('button', { name: /abrir en el navegador/i })
    .click();
  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'open');

  // Iframe should be in the DOM
  await expect(win(page, 'browser').locator('iframe')).toHaveCount(1);

  // Close the browser window
  await win(page, 'browser').getByRole('button', { name: /cerrar/i }).click();

  // Iframe must be removed
  await expect(page.locator('iframe')).toHaveCount(0);
});

// ── Test 5: refuses non-project URLs ─────────────────────────────────────────

test('browser refuses URLs that are not a project live URL', async ({ page }) => {
  await visit(page, '/');

  // Call openBrowser with a URL not in projects[].liveUrl via the e2e test hook
  await page.evaluate((url) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jgos = (window as any).__jgos;
    if (jgos?.openBrowser) jgos.openBrowser(url);
  }, forbiddenUrl);

  // Browser window must remain closed
  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'closed');

  // No iframe in the DOM
  await expect(page.locator('iframe')).toHaveCount(0);
});
