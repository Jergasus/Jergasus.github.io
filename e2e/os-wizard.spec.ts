import { readFileSync } from 'node:fs';
import { expect, test, visit, win, openFromIcon } from './fixtures';

/** Shorthand: the wizard root inside the business window. */
const wizard = (page: Parameters<typeof win>[0]) => win(page, 'business').locator('[data-wizard]');

// ── Step navigation ───────────────────────────────────────────────────────

test('walking the 3 steps produces a wa.me link whose text includes the choices', async ({
  page,
}) => {
  await visit(page, '/');
  await openFromIcon(page, 'business');

  const w = wizard(page);

  // Step 1: select "Bar o restaurante" (hospitality)
  await w.locator('input[name="business"][value="hospitality"]').check();
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Step 2: select "Una web nueva" (new-site)
  await w.locator('input[name="needs"][value="new-site"]').check();
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Step 3: pick WhatsApp channel (default), proceed to summary
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Summary: a wa.me link must exist
  const link = w.locator('a[href^="https://wa.me"]');
  await expect(link).toBeVisible();

  // The decoded message text must include the choices the user made
  const href = await link.getAttribute('href');
  const decoded = decodeURIComponent(href!.split('?text=')[1] ?? '');
  expect(decoded).toContain('Bar o restaurante');
  expect(decoded).toContain('Una web nueva');
});

// ── Focus management ──────────────────────────────────────────────────────

test('keyboard Next moves focus to step 2 heading; Back returns it to step 1', async ({
  page,
}) => {
  await visit(page, '/');
  await openFromIcon(page, 'business');

  const w = wizard(page);

  // Step 1: select a business type, then press Enter on Next
  await w.locator('input[name="business"][value="hospitality"]').check();
  await w.getByRole('button', { name: /siguiente/i }).focus();
  await page.keyboard.press('Enter');

  // Focus should land on the step-2 legend
  await expect(w.locator('[data-wizard-step="2"] legend')).toBeFocused();

  // Press Enter on Back to return to step 1
  await w.getByRole('button', { name: /atrás/i }).focus();
  await page.keyboard.press('Enter');

  // Focus should land on the step-1 legend
  await expect(w.locator('[data-wizard-step="1"] legend')).toBeFocused();
});

// ── Validity guard ─────────────────────────────────────────────────────────

test('Next is disabled until a step is valid', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'business');

  const w = wizard(page);
  const next = w.getByRole('button', { name: /siguiente/i });

  // Step 1: Next is disabled until a business is chosen
  await expect(next).toBeDisabled();
  await w.locator('input[name="business"][value="shop"]').check();
  await expect(next).toBeEnabled();
  await next.click();

  // Step 2: Next is disabled until at least one need is checked
  await expect(next).toBeDisabled();
  await w.locator('input[name="needs"][value="bookings"]').check();
  await expect(next).toBeEnabled();
  await next.click();

  // Step 3: Next is always enabled (all fields optional)
  await expect(next).toBeEnabled();
});

// ── Email channel ─────────────────────────────────────────────────────────

test('email channel produces mailto with subject and body', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'business');

  const w = wizard(page);

  // Step 1
  await w.locator('input[name="business"][value="beauty"]').check();
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Step 2
  await w.locator('input[name="needs"][value="redesign"]').check();
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Step 3: pick email channel
  await w.locator('input[name="channel"][value="email"]').check();
  await w.getByRole('button', { name: /siguiente/i }).click();

  // Summary: a mailto: link with subject= and body=
  const link = w.locator('a[href^="mailto:"]');
  await expect(link).toBeVisible();

  const href = await link.getAttribute('href');
  const url = new URL(href!);
  expect(url.searchParams.get('subject')).toBeTruthy();
  const body = url.searchParams.get('body');
  expect(body).toBeTruthy();
  expect(body).toContain('Peluquería o estética');
  expect(body).toContain('Renovar la que tengo');
});

// ── No prices ─────────────────────────────────────────────────────────────

for (const { locale, path } of [
  { locale: 'es', path: '/' },
  { locale: 'ca', path: '/ca/' },
  { locale: 'en', path: '/en/' },
]) {
  test(`no prices anywhere in the wizard (${locale})`, async ({ page }) => {
    await visit(page, path);
    await openFromIcon(page, 'business');

    // Open the wizard and check every step for price strings
    const w = wizard(page);

    // Check step 1
    const body1 = await win(page, 'business').textContent();
    expect(body1).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);

    // Advance to step 2
    await w.locator('input[name="business"]').first().check();
    await w.getByRole('button', { name: /siguiente|next|següent/i }).click();

    const body2 = await win(page, 'business').textContent();
    expect(body2).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);

    // Advance to step 3
    await w.locator('input[name="needs"]').first().check();
    await w.getByRole('button', { name: /siguiente|next|següent/i }).click();

    const body3 = await win(page, 'business').textContent();
    expect(body3).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);

    // Advance to summary
    await w.getByRole('button', { name: /siguiente|next|següent/i }).click();

    const bodySummary = await win(page, 'business').textContent();
    expect(bodySummary).not.toMatch(/€|\bdesde\s+\d|\bfrom\s+\d|\bdes de\s+\d/i);
  });
}
