import { expect, openFromIcon, test, visit, win } from './fixtures';

/** Shorthand: the text input inside the terminal window. */
const termInput = (page: Parameters<typeof win>[0]) =>
  win(page, 'terminal').getByRole('textbox');

/** The last line the terminal printed. */
const lastLine = (page: Parameters<typeof win>[0]) =>
  win(page, 'terminal').locator('.os-terminal-line').last();

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
  // Every help line is copy, not a message key (ICU reads a bare <app> as a tag).
  await expect(output).toContainText('abrir ‹app›');
  await expect(output).not.toContainText('os.terminal');

  // An unknown command names what was typed and hints to type ayuda.
  await run(page, 'xyzzy');
  await expect(lastLine(page)).toContainText('xyzzy');
  await expect(lastLine(page)).toContainText('ayuda');
});

// ── What was typed comes back in the reply, in every language ─────────────
// next-intl reads a straight apostrophe before a brace as an ICU quote: the
// reply printed "{cmd}" itself instead of the word.

for (const { path, open, lang } of [
  { path: '/', open: 'abrir', lang: 'idioma' },
  { path: '/ca/', open: 'obre', lang: 'idioma' },
  { path: '/en/', open: 'open', lang: 'lang' },
] as const) {
  test(`the replies name the unknown word, app and language (${path})`, async ({ page }) => {
    await visit(page, path);
    await openFromIcon(page, 'terminal');

    await run(page, 'xyzzy');
    await expect(lastLine(page)).toContainText('xyzzy');
    await run(page, `${open} nada`);
    await expect(lastLine(page)).toContainText('nada');
    await run(page, `${lang} fr`);
    await expect(lastLine(page)).toContainText('fr');
    await expect(win(page, 'terminal').getByRole('log')).not.toContainText(/[{}]/);
  });
}

// ── sobre ─────────────────────────────────────────────────────────────────

test('sobre opens the about window, as its help line says', async ({ page }) => {
  await visit(page, '/');
  // about starts closed on home load; verify it and open it via terminal.
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'closed');
  await openFromIcon(page, 'terminal');

  await run(page, 'sobre');
  await expect(win(page, 'about')).toHaveAttribute('data-win-state', 'open');
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

// ── abrir actividad ───────────────────────────────────────────────────────

test('abrir actividad opens the activity window', async ({ page }) => {
  await visit(page, '/');
  await openFromIcon(page, 'terminal');

  await run(page, 'abrir actividad');
  await expect(win(page, 'activity')).toHaveAttribute('data-win-state', 'open');
});
