import { expect, test, visit, win, openFromIcon } from './fixtures';

/** Shorthand: the text input inside the terminal window. */
const termInput = (page: Parameters<typeof win>[0]) =>
  win(page, 'terminal').getByRole('textbox');

/** Type a command and press Enter. */
async function run(page: Parameters<typeof win>[0], cmd: string) {
  const input = termInput(page);
  await input.fill(cmd);
  await input.press('Enter');
}

// ── ayuda / unknown ───────────────────────────────────────────────────────

test('ayuda lists commands; unknown commands hint to type ayuda', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  const output = win(page, 'terminal').getByRole('log');

  // ayuda should produce multiple help lines
  await run(page, 'ayuda');
  const helpText = await output.textContent();
  // The output should contain text for several commands
  expect(helpText).toMatch(/ayuda|ajuda|help/i);
  expect(helpText).toMatch(/proyectos|projectes|projects/i);

  // An unknown command should hint to type ayuda
  await run(page, 'xyzzy');
  const afterUnknown = await output.textContent();
  expect(afterUnknown).toMatch(/ayuda|help|ajuda/i);
});

// ── abrir questday ────────────────────────────────────────────────────────

test('abrir questday navigates to /work/questday/', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  await run(page, 'abrir questday');

  // The URL should update to the questday case study
  await expect(page).toHaveURL(/\/work\/questday\//);
});

// ── sudo contratar ────────────────────────────────────────────────────────

test('sudo contratar opens the contact window', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  await run(page, 'sudo contratar');

  await expect(win(page, 'contact')).toHaveAttribute('data-win-state', 'open');
});

// ── idioma / tema ─────────────────────────────────────────────────────────

test('idioma en goes to the English path; tema noche sets data-theme=dark', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  // tema noche first (before the page navigates away)
  await run(page, 'tema noche');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // idioma en navigates to the English locale
  await run(page, 'idioma en');
  await expect(page).toHaveURL(/\/en\//);
});

// ── History (Up / Down) ───────────────────────────────────────────────────

test('Up recalls the previous command', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  const input = termInput(page);

  // Type and submit a command
  await run(page, 'ayuda');

  // Clear the input and press Up
  await input.click();
  await input.press('ArrowUp');

  // The previous command should be restored
  await expect(input).toHaveValue('ayuda');
});
