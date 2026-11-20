/**
 * Retro browser e2e tests (Task 11).
 *
 * Uses page.route to fulfil or stall project URLs — never makes real network
 * requests to the live sites.
 *
 * URL-refusal logic is covered by unit tests in
 * src/os/browser-allowlist.test.ts (R11).
 */
import { expect, test, win, visit, openFromIcon } from './fixtures';
import { projects } from '../src/content/projects';

/** Only projects with a live URL. */
const liveProjects = projects.filter((p) => p.liveUrl !== null);
const questday = projects.find((p) => p.slug === 'questday')!;
const questdayUrl = questday.liveUrl!; // https://playquestday.com

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

// ── Test 2: Abrir en el navegador loads the iframe (success path) ─────────────

test('QuestDay window → Abrir en el navegador loads playquestday.com in an iframe', async ({
  page,
}) => {
  // Fulfil the route with a stub so the iframe loads without hitting the real site.
  await stubRoute(page, `${questdayUrl}/**`);
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

  // ── Success path: loading state must clear and iframe become visible ───────
  // The stub loads immediately (cross-origin SecurityError → handleLoad clears the
  // 8-second timer).  Wait for the loading overlay to leave the DOM.
  await expect(
    win(page, 'browser').locator('.os-browser-overlay'),
  ).not.toBeAttached();

  // Iframe is now visible (style.visibility changed from 'hidden' to 'visible').
  await expect(
    win(page, 'browser').locator(`iframe[src="${questdayUrl}"]`),
  ).toBeVisible();
});

// ── Test 3: fallback when the site stalls ─────────────────────────────────────

test('shows the fallback when the site does not load', async ({ page }) => {
  // Stall the request: the route handler is registered but never calls
  // route.fulfill() or route.abort(), so the iframe's navigation hangs
  // indefinitely.  onLoad never fires; the 8-second timer governs the state.
  await page.route(questdayUrl, (_route) => { /* stalled — intentional */ });
  await page.route(`${questdayUrl}/**`, (_route) => { /* stalled — intentional */ });

  await visit(page, '/work/questday/');

  // Install the fake clock before the click so the 8 s timer is controlled.
  await page.clock.install({ time: Date.now() });

  await win(page, 'questday')
    .getByRole('button', { name: /abrir en el navegador/i })
    .click();

  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'open');

  // Skip past the 8-second timeout
  await page.clock.fastForward(9_000);

  // The fallback message should be visible (os.browser.failed)
  await expect(
    win(page, 'browser').locator('[data-browser-failed]'),
  ).toBeVisible();

  // The "Abrir en una pestaña nueva" link in the fallback must be visible
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

  // Iframe must be removed from the DOM
  await expect(page.locator('iframe')).toHaveCount(0);
});

// ── Test 5: browser only surfaces live project URLs ───────────────────────────
//
// URL refusal is proven by browser-allowlist.test.ts unit tests.
// This test proves the UI only offers and loads allowlisted project URLs.

test('browser only surfaces live project URLs', async ({ page }) => {
  const liveUrls = new Set(liveProjects.map((p) => p.liveUrl!));

  // ── 5a. Browser start page lists exactly one button per live project ───────
  await visit(page, '/');

  // Open the browser window via its desktop icon (keyboard-style: focus + Enter).
  await openFromIcon(page, 'browser');
  await expect(win(page, 'browser')).toHaveAttribute('data-win-state', 'open');

  // The start page shows one button per live project — not for projects without
  // a live URL (rally-voley, yokaido).
  await expect(
    win(page, 'browser').locator('.os-browser-start-list button'),
  ).toHaveCount(liveProjects.length);

  // Close so we can visit case pages cleanly
  await win(page, 'browser').getByRole('button', { name: /cerrar/i }).click();

  // ── 5b. Case windows: "Abrir en el navegador" appears only for live projects ─
  // questday has a live URL → button present
  await visit(page, '/work/questday/');
  await expect(
    win(page, 'questday').getByRole('button', { name: /abrir en el navegador/i }),
  ).toHaveCount(1);

  // rally-voley has no live URL → button absent
  await visit(page, '/work/rally-voley/');
  await expect(
    win(page, 'rally-voley').getByRole('button', { name: /abrir en el navegador/i }),
  ).toHaveCount(0);

  // ── 5c. The iframe src produced by clicking the button is in the allowlist ─
  await stubRoute(page, `${questdayUrl}/**`);
  await page.route(questdayUrl, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: STUB_HTML }),
  );

  await visit(page, '/work/questday/');
  await win(page, 'questday')
    .getByRole('button', { name: /abrir en el navegador/i })
    .click();

  const iframeSrc = await win(page, 'browser').locator('iframe').getAttribute('src');
  expect(
    liveUrls.has(iframeSrc!),
    `iframe src "${iframeSrc}" must be in the live URL allowlist`,
  ).toBe(true);
});
