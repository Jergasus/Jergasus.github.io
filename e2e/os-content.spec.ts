import { readFileSync } from 'node:fs';
import type { ActivitySnapshot } from '@/lib/activity';
import type { Status } from '@/lib/status';
import type { Locale } from '@/i18n/routing';
import { projects } from '@/content/projects';
import { STACK } from '@/content/stack';
import { expect, test, visit, win } from './fixtures';

// What each window says, from the committed data and copy (v1's hero, now and
// work guards, moved onto the windows). Expected values are read with fs, not
// computed by the code under test.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

type Messages = {
  hero: { availability: { available: string; unavailable: string } };
  about: { bio: string };
  work: { status: Record<'live' | 'building' | 'wip', string> };
};
const messages = (locale: Locale) => readJson<Messages>(`../messages/${locale}.json`);
const snapshot = readJson<ActivitySnapshot>('../data/activity.json');
const status = readJson<Status>('../content/status.json');

const LOCALES: { locale: Locale; path: string }[] = [
  { locale: 'es', path: '/' },
  { locale: 'ca', path: '/ca/' },
  { locale: 'en', path: '/en/' },
];

const expectedAvailability = (locale: Locale) =>
  status.availabilityLabel?.[locale] ||
  messages(locale).hero.availability[status.available ? 'available' : 'unavailable'];

const weekly = Array.from({ length: 26 }, (_, i) =>
  snapshot.repos.reduce((sum, repo) => sum + (repo.weekly[i] ?? 0), 0),
);
const totalWeekly = weekly.reduce((sum, n) => sum + n, 0);
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
  test(`about shows the name, bio and availability label (${locale})`, async ({ page }) => {
    await visit(page, path);
    const about = win(page, 'about');
    await expect(about.getByRole('heading', { level: 2 })).toHaveText('Jesús García');
    await expect(about.getByText(messages(locale).about.bio)).toBeVisible();
    await expect(about.getByText(expectedAvailability(locale), { exact: true })).toBeVisible();
    await expect(about.getByRole('img')).toHaveAttribute('src', '/about/jesus-garcia.webp');
  });
}

test('projects lists 4 projects in order with status labels; yokaido opens its card, not a page', async ({ page }) => {
  await visit(page, '/');
  const list = win(page, 'projects');
  const items = list.locator('[data-open-app]');
  await expect(items).toHaveText(projects.map((project) => new RegExp(project.name)));
  const { work } = messages('es');
  for (const [i, project] of projects.entries()) {
    await expect(items.nth(i)).toBeVisible();
    await expect(items.nth(i)).toContainText(work.status[project.status]);
  }
  for (const slug of ['questday', 'sakurai', 'rally-voley']) {
    await expect(list.locator(`a[data-open-app="${slug}"]`)).toHaveAttribute('href', `/work/${slug}/`);
  }

  const yokaido = list.getByRole('button', { name: /Yokaido/ });
  await expect(yokaido).toHaveAttribute('data-open-app', 'yokaido');
  await yokaido.click();
  await expect(win(page, 'yokaido')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'yokaido')).toBeVisible();
  await expect(win(page, 'yokaido')).toBeFocused();
  await expect(win(page, 'yokaido')).toContainText('Godot 4');
  await expect(win(page, 'yokaido')).toContainText(work.status.wip);
  await expect(page).toHaveURL('/');

  await win(page, 'yokaido').locator('[data-win-close]').click();
  await expect(win(page, 'yokaido')).toHaveAttribute('data-win-state', 'closed');
  await expect(yokaido).toBeFocused();
});

test('project links keep the locale', async ({ page }) => {
  await visit(page, '/en/');
  for (const slug of ['questday', 'sakurai', 'rally-voley']) {
    await expect(win(page, 'projects').locator(`a[data-open-app="${slug}"]`)).toHaveAttribute(
      'href',
      `/en/work/${slug}/`,
    );
  }
});

// Activity, system and the other closed-on-load windows are read as a
// document (no JavaScript) until the desktop icons that open them exist.
test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const { locale, path } of LOCALES) {
    test(`activity shows 26 cells and the caption ends on the snapshot date (${locale})`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(generatedAt.getTime() + 90 * DAY));
      await page.goto(path);
      const activity = win(page, 'activity');
      await expect(activity.locator('[data-now-grid] [data-intensity]')).toHaveCount(26);
      // The cells only draw the caption: hidden from assistive tech.
      await expect(activity.locator('[aria-hidden="true"]:has(> [data-intensity])')).toHaveCount(1);
      const caption = activity.locator('[data-now-caption]');
      await expect(caption).toBeVisible();
      await expect(caption).toContainText(snapshotDate(locale));
      await expect(caption).toContainText(
        new RegExp(`\\b${new Intl.NumberFormat(locale).format(totalWeekly)}\\b`),
      );
    });

    test(`activity currently-building matches content/status.json (${locale})`, async ({ page }) => {
      await page.goto(path);
      await expect(win(page, 'activity')).toContainText(status.currentlyBuilding[locale]);
    });
  }

  test('activity lists every project with its commits', async ({ page }) => {
    await page.goto('/');
    const rows = win(page, 'activity').locator('tbody tr');
    await expect(rows).toHaveCount(snapshot.repos.length);
    for (const [i, repo] of snapshot.repos.entries()) {
      const name = projects.find((project) => project.slug === repo.slug)!.name;
      await expect(rows.nth(i)).toContainText(name);
      await expect(rows.nth(i)).toContainText(new Intl.NumberFormat('es').format(repo.totalCommits));
    }
  });

  test('system lists every STACK item', async ({ page }) => {
    await page.goto('/');
    const system = win(page, 'system');
    await expect(system.getByRole('heading', { level: 2 })).toHaveText('Propiedades del sistema');
    for (const fact of ['JG-OS', 'Jesús García', 'Barcelona']) await expect(system).toContainText(fact);
    await expect(system.getByRole('list').getByRole('listitem')).toHaveText([...STACK]);
  });

  test('yokaido is a link to its card', async ({ page }) => {
    await page.goto('/');
    const link = win(page, 'projects').getByRole('link', { name: /Yokaido/ });
    await expect(link).toHaveAttribute('href', '#yokaido');
    await expect(win(page, 'projects').getByRole('button')).toHaveCount(0);
    await expect(win(page, 'yokaido')).toBeVisible();
  });
});
