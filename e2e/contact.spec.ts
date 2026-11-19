import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { contact, mailtoHref } from '@/content/contact';

// Read message files the same way hero.spec.ts reads activity.json — avoids
// retyping expected strings and keeps the test in sync with the source.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

type Subset = { contact: { whatsappMessage: string } };
const messages = {
  es: readJson<Subset>('../messages/es.json'),
  en: readJson<Subset>('../messages/en.json'),
};

// ── Email ─────────────────────────────────────────────────────────────────

test('email link', async ({ page }) => {
  await page.goto('/');
  const link = page.locator(`a[href="${mailtoHref()}"]`).first();
  await expect(link).toBeVisible();
});

// ── WhatsApp ──────────────────────────────────────────────────────────────

for (const { locale, path } of [
  { locale: 'es' as const, path: '/' },
  { locale: 'en' as const, path: '/en/' },
]) {
  test(`whatsapp link per locale (${locale})`, async ({ page }) => {
    await page.goto(path);
    const link = page.locator(
      `a[href^="https://wa.me/${contact.whatsappNumber}?text="]`,
    );
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    const decoded = new URL(href!).searchParams.get('text')!;
    expect(decoded).toBe(messages[locale].contact.whatsappMessage);
  });

  test(`whatsapp link accessible name (${locale})`, async ({ page }) => {
    await page.goto(path);
    const link = page.locator(
      `a[href^="https://wa.me/${contact.whatsappNumber}?text="]`,
    );
    // aria-label is "WhatsApp: {number}" with the display number interpolated.
    // toHaveAccessibleName uses computed role name, so it reads the aria-label.
    await expect(link).toHaveAccessibleName(
      `WhatsApp: ${contact.whatsappDisplay}`,
    );
  });
}

// ── LinkedIn + GitHub ─────────────────────────────────────────────────────

test('linkedin + github hrefs and rel=noopener', async ({ page }) => {
  await page.goto('/');

  const linkedin = page.locator(`a[href="${contact.linkedin}"]`).first();
  await expect(linkedin).toBeVisible();
  expect(await linkedin.getAttribute('rel')).toContain('noopener');

  const github = page.locator(`a[href="${contact.github}"]`).first();
  await expect(github).toBeVisible();
  expect(await github.getAttribute('rel')).toContain('noopener');
});

// ── No prices ────────────────────────────────────────────────────────────

const caseUrls = ['', '/ca', '/en'].flatMap((prefix) =>
  ['questday', 'sakurai', 'rally-voley'].map((slug) => `${prefix}/work/${slug}/`),
);

for (const path of ['/', '/ca/', '/en/', ...caseUrls]) {
  test(`no prices on page (${path})`, async ({ page }) => {
    const response = await page.goto(path);
    // A 404 page has no prices either; make sure the real page is checked.
    expect(response!.status()).toBe(200);
    const body = await page.textContent('body');
    expect(body).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);
  });
}

// ── No CV link ────────────────────────────────────────────────────────────

test('no CV link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
});
