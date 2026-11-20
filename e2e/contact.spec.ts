import { readFileSync } from 'node:fs';
import { contact, mailtoHref } from '@/content/contact';
import { expect, test, visit, win, openFromIcon } from './fixtures';

// Read message files the same way the other specs read data — avoids
// retyping expected strings and keeps the test in sync with the source.
const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

type Subset = { contact: { whatsappMessage: string } };
const messages = {
  es: readJson<Subset>('../messages/es.json'),
  en: readJson<Subset>('../messages/en.json'),
};

// R3 follow-up: contact opens from its desktop icon (JS on).
test('contact opens from its desktop icon and shows links (JS on)', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'contact');
  await expect(win(page, 'contact')).toHaveAttribute('data-win-state', 'open');
  await expect(win(page, 'contact')).toBeFocused();
  // Email link is present in the open window
  await expect(win(page, 'contact').locator(`a[href="${mailtoHref()}"]`)).toBeVisible();
});

// The contact window is closed on load and opens from its desktop icon (a
// later task); until then its links are checked where every visitor
// without JavaScript reads them: the document.
test.describe('contact window, as a document', () => {
  test.use({ javaScriptEnabled: false });

  test('email link', async ({ page }) => {
    await page.goto('/');
    await expect(win(page, 'contact').locator(`a[href="${mailtoHref()}"]`)).toBeVisible();
  });

  for (const { locale, path } of [
    { locale: 'es' as const, path: '/' },
    { locale: 'en' as const, path: '/en/' },
  ]) {
    test(`whatsapp link per locale (${locale})`, async ({ page }) => {
      await page.goto(path);
      const link = win(page, 'contact').locator(`a[href^="https://wa.me/${contact.whatsappNumber}?text="]`);
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      const decoded = new URL(href!).searchParams.get('text')!;
      expect(decoded).toBe(messages[locale].contact.whatsappMessage);
    });

    test(`whatsapp link accessible name (${locale})`, async ({ page }) => {
      await page.goto(path);
      const link = win(page, 'contact').locator(`a[href^="https://wa.me/${contact.whatsappNumber}?text="]`);
      // aria-label is "WhatsApp: {number}" with the display number interpolated.
      await expect(link).toHaveAccessibleName(`WhatsApp: ${contact.whatsappDisplay}`);
    });
  }

  test('linkedin + github hrefs and rel=noopener', async ({ page }) => {
    await page.goto('/');
    for (const href of [contact.linkedin, contact.github]) {
      const link = win(page, 'contact').locator(`a[href="${href}"]`);
      await expect(link).toBeVisible();
      expect(await link.getAttribute('rel')).toContain('noopener');
    }
  });
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
    // Every window's text, open or not.
    const body = await page.textContent('body');
    expect(body).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);
  });
}

// ── No CV link ────────────────────────────────────────────────────────────

test('no CV link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
});
