import { test, expect, type Page } from '@playwright/test';

// The preview island marks itself after hydration: data-preview="on" when the
// device has a fine, hovering pointer, "off" otherwise. Waiting for it makes the
// "no preview" assertions below mean something (they are not run before React).
const previewReady = (page: Page, state: 'on' | 'off') =>
  expect(page.locator(`#work [data-preview="${state}"]`)).toHaveCount(1);

const rows = (page: Page) => page.getByTestId('work-row');
const row = (page: Page, name: string) => rows(page).filter({ hasText: name });
const previewImage = (page: Page) => page.locator('[data-testid=hover-preview] img');

// The preview frame's on-screen box: what the visitor sees following the pointer.
const frameBox = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[data-testid=hover-preview] [data-state]')!;
    const { left, top } = frame.getBoundingClientRect();
    return { left, top };
  });
const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

// Puts the pointer on the SakurAI row (in view) and returns its vertical centre.
async function pointAtSakurai(page: Page) {
  const sakurai = row(page, 'SakurAI');
  await sakurai.scrollIntoViewIfNeeded();
  const box = (await sakurai.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 40, y);
  await expect(previewImage(page)).toBeVisible();
  return { x: box.x + 40, y };
}

test('four rows in order', async ({ page }) => {
  await page.goto('/');
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page)).toContainText(['QuestDay', 'SakurAI', 'Rally Voley', 'Yokaido']);
  await expect(rows(page)).toContainText(['01', '02', '03', '04']);
});

test('rows show the one-liner, two stack items and the status', async ({ page }) => {
  await page.goto('/en/');
  const questday = row(page, 'QuestDay');
  await expect(questday).toContainText('Daily puzzle platform');
  await expect(questday).toContainText('Next.js 16');
  await expect(questday).toContainText('React 19');
  // Only the first two stack items.
  await expect(questday).not.toContainText('Cloudflare Workers');
  await expect(questday).toContainText('Live');
  await expect(row(page, 'Rally Voley')).toContainText('Building');
  await expect(row(page, 'Yokaido')).toContainText('In design');
});

test('yokaido row is not a link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Yokaido/ })).toHaveCount(0);
  const yokaido = row(page, 'Yokaido');
  // Plain content, not a disabled control: nothing to focus, no disabled
  // state for assistive tech, and the status label says why it has no page.
  await expect(yokaido.locator('a, [tabindex]')).toHaveCount(0);
  await expect(yokaido).not.toHaveAttribute('aria-disabled');
  await expect(yokaido).toContainText('En diseño');
});

test('es link targets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#work').getByRole('link', { name: 'QuestDay' })).toHaveAttribute(
    'href',
    '/work/questday/',
  );
  await page.goto('/en/');
  await expect(page.locator('#work').getByRole('link', { name: 'QuestDay' })).toHaveAttribute(
    'href',
    '/en/work/questday/',
  );
});

for (const { path, prefix } of [
  { path: '/', prefix: '' },
  { path: '/ca/', prefix: '/ca' },
  { path: '/en/', prefix: '/en' },
]) {
  test(`every case-study row links in its locale (${path})`, async ({ page }) => {
    await page.goto(path);
    const links = page.locator('#work a');
    await expect(links).toHaveCount(3);
    for (const slug of ['questday', 'sakurai', 'rally-voley']) {
      await expect(page.locator(`#work a[href="${prefix}/work/${slug}/"]`)).toHaveCount(1);
    }
  });
}

test('hover shows preview', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  await row(page, 'QuestDay').hover();
  await expect(previewImage(page)).toBeVisible();
  await expect(previewImage(page)).toHaveAttribute('src', /questday/);
  await expect(previewImage(page)).toHaveAttribute('alt', '');

  // Moving to another row swaps the image.
  await row(page, 'SakurAI').hover();
  await expect(previewImage(page)).toHaveAttribute('src', /sakurai/);

  // Leaving the index hides it.
  await page.mouse.move(2, 2);
  await expect(previewImage(page)).toBeHidden();
});

test('preview is decorative and never takes the pointer', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  await row(page, 'QuestDay').hover();
  const preview = page.getByTestId('hover-preview');
  await expect(preview).toHaveAttribute('aria-hidden', 'true');
  await expect(preview).toHaveCSS('pointer-events', 'none');
  await expect(preview).toHaveCSS('position', 'fixed');
});

test('yokaido row shows no preview', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  await row(page, 'Rally Voley').hover();
  await expect(previewImage(page)).toBeVisible();
  await row(page, 'Yokaido').hover();
  await expect(previewImage(page)).toBeHidden();
});

test('keyboard focus leaves no preview', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  await page.locator('#work').getByRole('link', { name: 'QuestDay' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#work').getByRole('link', { name: 'SakurAI' })).toBeFocused();
  await expect(previewImage(page)).toHaveCount(0);
});

test('preview images load before the first hover', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/previews/')) requested.push(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await previewReady(page, 'on');
  await page.locator('#work').scrollIntoViewIfNeeded();
  // One format per project (the browser picks AVIF or WebP), before any hover.
  await expect.poll(() => new Set(requested.map((p) => p.split('.')[0])).size).toBe(3);
});

// HoverPreview finds the sticky header through [data-site-header]; it must
// match exactly one element or the preview could rise behind the header.
test('site header contract', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-site-header]')).toHaveCount(1);
});

test('preview stays below the site header', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  const { headerBottom, lift, height } = await page.evaluate(() => {
    const frame = document.querySelector<HTMLElement>('[data-testid=hover-preview] [data-state]')!;
    return {
      headerBottom: document.querySelector('[data-site-header]')!.getBoundingClientRect().bottom,
      lift: -(frame.offsetTop + frame.offsetHeight),
      height: frame.offsetHeight,
    };
  });
  // At this height a frame placed above the pointer would end up 10px behind
  // the header. Scroll the QuestDay row under it and point there.
  const y = headerBottom + lift + height - 10;
  const questday = row(page, 'QuestDay');
  await questday.evaluate((element, pointerY) => {
    const box = element.getBoundingClientRect();
    window.scrollBy(0, box.top + box.height / 2 - pointerY);
  }, y);
  const box = (await questday.boundingBox())!;
  await page.mouse.move(box.x + 200, y);
  await expect(previewImage(page)).toBeVisible();
  expect((await frameBox(page)).top).toBeGreaterThanOrEqual(headerBottom);
});

test('preview trails the pointer with lerp', async ({ page }) => {
  await page.goto('/');
  await previewReady(page, 'on');
  const { x, y } = await pointAtSakurai(page);
  const start = await frameBox(page);

  await page.mouse.move(x + 300, y);
  await nextFrame(page);
  const moving = await frameBox(page);
  // Partway there after a frame...
  expect(moving.left).toBeGreaterThan(start.left);
  expect(moving.left).toBeLessThan(start.left + 300 - 1);
  // ...and it settles on the target.
  await expect.poll(async () => (await frameBox(page)).left - start.left).toBeCloseTo(300, 0);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('preview snaps to the pointer', async ({ page }) => {
    await page.goto('/');
    await previewReady(page, 'on');
    const { x, y } = await pointAtSakurai(page);
    const start = await frameBox(page);

    await page.mouse.move(x + 300, y);
    await nextFrame(page);
    expect((await frameBox(page)).left - start.left).toBeCloseTo(300, 0);
  });
});

test.describe('touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } });

  test('touch: no preview, tap navigates', async ({ page }) => {
    await page.goto('/');
    await previewReady(page, 'off');
    await expect(page.getByTestId('hover-preview')).toHaveCount(0);
    const navigation = page.waitForRequest((request) =>
      new URL(request.url()).pathname.startsWith('/work/sakurai/'),
    );
    await row(page, 'SakurAI').tap();
    // The tap asks for /work/sakurai/ (the router's payload fetch)...
    await navigation;
    // ...and lands on the case page, trailing slash included.
    await expect(page).toHaveURL('/work/sakurai/');
  });
});
