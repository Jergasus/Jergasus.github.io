import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { ActivitySnapshot } from '@/lib/activity';
import type { Status } from '@/lib/status';
import type { Locale } from '@/i18n/routing';

// Expected values come straight from the committed files, not from the
// aggregation code under test. Read with fs: the repo is ESM, and Playwright's
// loader rejects JSON imports without an import attribute.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

const snapshot = readJson<ActivitySnapshot>('../data/activity.json');
const status = readJson<Status>('../content/status.json');

// Compute the aggregate weekly total from the fixture (element-wise sum, 26 weeks).
const weekly = new Array<number>(26).fill(0);
for (const repo of snapshot.repos) {
  for (let i = 0; i < 26; i++) {
    weekly[i] += repo.weekly[i] ?? 0;
  }
}
const totalWeekly = weekly.reduce((s, n) => s + n, 0);

const LOCALES: { locale: Locale; path: string }[] = [
  { locale: 'es', path: '/' },
  { locale: 'ca', path: '/ca/' },
  { locale: 'en', path: '/en/' },
];

// Step 1 (TDD): these tests are written before the implementation and must FAIL
// until the NowSection + ActivityGrid components are added.

test('26 cells', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#now [data-intensity]')).toHaveCount(26);
});

test('grid caption sums fixture', async ({ page }) => {
  await page.goto('/');
  // The caption is visible text, so sighted visitors and assistive tech read
  // the same sentence. Word-boundary anchors prevent a false positive when
  // totalWeekly happens to be a substring of a longer number (e.g. 251 ≠ 1251).
  // Intl formats it per locale; Spanish leaves four digits ungrouped.
  const caption = page.locator('#now [data-now-caption]');
  await expect(caption).toBeVisible();
  await expect(caption).toHaveText(
    new RegExp(`\\b${new Intl.NumberFormat('es').format(totalWeekly)}\\b`),
  );
  // The cells only draw the caption: their container is hidden from
  // assistive tech, so the count is not announced twice.
  await expect(page.locator('#now [aria-hidden="true"]:has(> [data-intensity])')).toHaveCount(1);
});

// Ruling R17: the caption names the date the 26 weeks end on, so it stays
// true however old the snapshot is when someone reads it.
const DAY = 24 * 60 * 60 * 1000;
const generatedAt = new Date(snapshot.generatedAt);
const snapshotDate = (locale: Locale) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(generatedAt);

for (const { locale, path } of LOCALES) {
  test(`grid caption ends on the snapshot date, even when stale (${locale})`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(generatedAt.getTime() + 90 * DAY));
    await page.goto(path);
    const caption = page.locator('#now [data-now-caption]');
    await expect(caption).toContainText(snapshotDate(locale));
    await expect(caption).toContainText(new Intl.NumberFormat(locale).format(totalWeekly));
  });
}

for (const { locale, path } of LOCALES) {
  test(`currently building text matches status.json (${locale})`, async ({ page }) => {
    await page.goto(path);
    const expected = status.currentlyBuilding[locale];
    await expect(page.locator('#now')).toContainText(expected);
  });
}
