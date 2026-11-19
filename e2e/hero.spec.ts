import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { ActivitySnapshot } from '@/lib/activity';
import { formatRelative } from '@/lib/dates';
import type { Status } from '@/lib/status';
import type { Locale } from '@/i18n/routing';

// Expected values come straight from the committed files, not from the
// aggregation code under test. Read with fs: the repo is ESM, and Playwright's
// loader rejects JSON imports without an import attribute.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const snapshot = readJson<ActivitySnapshot>('../data/activity.json');
const status = readJson<Status>('../content/status.json');
type HeroMessages = { hero: { availability: { available: string; unavailable: string } } };
// status.json's custom label if it has one, else the current state's default.
const expectedAvailability = (locale: Locale) =>
  status.availabilityLabel?.[locale] ||
  readJson<HeroMessages>(`../messages/${locale}.json`).hero.availability[
    status.available ? 'available' : 'unavailable'
  ];

const DAY = 24 * 60 * 60 * 1000;
const total = snapshot.repos.reduce((sum, repo) => sum + repo.totalCommits, 0);
const lastCommitAt = snapshot.repos.map((repo) => repo.lastCommitAt).sort().at(-1)!;
const lastCommit = new Date(lastCommitAt);

const LOCALES: { locale: Locale; path: string }[] = [
  { locale: 'es', path: '/' },
  { locale: 'ca', path: '/ca/' },
  { locale: 'en', path: '/en/' },
];

for (const { locale, path } of LOCALES) {
  test(`hero shows name (${locale})`, async ({ page }) => {
    await page.goto(path);
    const heading = page.locator('h1');
    await expect(heading).toHaveCount(1);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAccessibleName('Jesús García');
    await expect(heading).toHaveText('Jesús García');
  });

  test(`strip shows totals (${locale})`, async ({ page }) => {
    await page.goto(path);
    const expected = new Intl.NumberFormat(locale).format(total);
    await expect(page.getByTestId('data-strip')).toContainText(expected);
  });
}

for (const { locale, path } of LOCALES.filter(({ locale }) => locale !== 'ca')) {
  test(`availability label (${locale})`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId('availability')).toHaveText(expectedAvailability(locale));
  });

  test(`shows relative time when fresh (${locale})`, async ({ page }) => {
    const now = new Date(lastCommit.getTime() + 3 * DAY);
    await page.clock.setFixedTime(now);
    await page.goto(path);
    const expected = formatRelative(lastCommitAt, now, locale);
    const item = page.getByTestId('last-commit');
    await expect(item).toContainText(expected);
    await expect(item.locator('time')).toHaveAttribute('datetime', lastCommitAt);
  });
}

test('hides relative time when stale', async ({ page }) => {
  await page.clock.setFixedTime(new Date(lastCommit.getTime() + 20 * DAY));
  await page.goto('/');
  // The strip itself must render, so an absent item is not a vacuous pass.
  await expect(page.getByTestId('availability')).toBeVisible();
  await expect(page.getByTestId('last-commit')).toHaveCount(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('server render shows the absolute date', async ({ page }) => {
    // The build ran moments ago, so "fresh now" is "fresh at build time".
    test.skip(Date.now() - lastCommit.getTime() > 14 * DAY, 'snapshot was stale at build time');
    await page.goto('/');
    const time = page.getByTestId('last-commit').locator('time');
    await expect(time).toHaveAttribute('datetime', lastCommitAt);
    const absolute = new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Madrid',
    }).format(lastCommit);
    await expect(time).toHaveText(absolute);
  });
});

// Rulings R10/R11: the name is set at poster scale, on two lines below the lg
// breakpoint (1024px) and on one line from it. The longest rendered line spans
// 85-95% of the content width (the strip spans exactly the content width).
for (const width of [375, 768, 1440]) {
  test(`hero name spans poster width at ${width}px`, async ({ page }) => {
    // Measure the settled layout: no line may be mid-reveal.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const { rows, ratio } = await page.evaluate(() => {
      // Group the line spans' text boxes by the row they render on.
      const extents = new Map<number, { left: number; right: number }>();
      for (const line of document.querySelectorAll('h1 [data-hero-line]')) {
        const range = document.createRange();
        range.selectNodeContents(line);
        const box = range.getBoundingClientRect();
        const row = extents.get(Math.round(box.top)) ?? { left: Infinity, right: -Infinity };
        extents.set(Math.round(box.top), {
          left: Math.min(row.left, box.left),
          right: Math.max(row.right, box.right),
        });
      }
      const widest = Math.max(...[...extents.values()].map((row) => row.right - row.left));
      const content = document.querySelector('[data-testid=data-strip]')!.getBoundingClientRect();
      return { rows: extents.size, ratio: widest / content.width };
    });
    expect(rows).toBe(width >= 1024 ? 1 : 2);
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(0.95);
  });
}

// Spec §2 goal 1: real activity is visible on the first screen.
for (const [width, height] of [
  [375, 667],
  [768, 1024],
  [1440, 900],
]) {
  test(`data strip is on the first screen at ${width}x${height}`, async ({ page }) => {
    // Measure the settled layout: no rule or cell may be mid-reveal.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const bottom = await page
      .getByTestId('data-strip')
      .evaluate((strip) => strip.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(height);
  });
}

test('hero has no horizontal scroll at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');
  await expect(page.getByTestId('data-strip')).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
