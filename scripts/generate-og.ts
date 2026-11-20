/**
 * One-time script to generate OG images (1200×630) for each locale.
 * Uses Playwright (already a devDependency) to screenshot an HTML template
 * built from the site's design tokens (JG-OS day colours).
 *
 * Colour values are parsed from the day :root block of
 * src/design/os-tokens.css: if the tokens change, re-running this script keeps
 * the OG art in sync. (The card itself is redrawn in the OS style later.) The host printed
 * on the card is SITE_URL's, so re-run it after adding public/CNAME.
 *
 * Run from the project root:  npx tsx scripts/generate-og.ts
 *
 * Output: public/og/{es,ca,en}.png  (committed to the repo)
 * This script is NEVER imported by src/ and must NOT run in CI or npm test.
 */

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_URL } from '../src/content/site';

const root = new URL('..', import.meta.url).pathname;

// ── Token parser ─────────────────────────────────────────────────────────────

/**
 * Parse `--os-*: <value>;` declarations from the first (day) :root block of
 * a CSS file, ignoring comments. Returns a map of token name → raw value.
 */
function parseColorTokens(cssPath: string): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8');
  // Strip comments (/* … */) before matching to avoid picking up values
  // that appear only in comments.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const day = stripped.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const tokens: Record<string, string> = {};
  for (const match of day.matchAll(/--os-([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const tokenCss = join(root, 'src/design/os-tokens.css');
const colors = parseColorTokens(tokenCss);

/**
 * The card is drawn from these tokens and nothing else. A token that is
 * missing or not a hex colour (a new token file might use oklch() or var())
 * stops the script, rather than quietly drawing the card in old colours.
 */
function hexToken(name: string): string {
  const value = colors[name];
  if (!value || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
    throw new Error(
      `src/design/os-tokens.css: --os-${name} must be a hex colour for the OG image, found ${value ? `"${value}"` : 'nothing'}`,
    );
  }
  return value;
}

const COLOR_PAPER = hexToken('window');
const COLOR_INK = hexToken('ink');
const COLOR_INK_MUTED = hexToken('ink');
const COLOR_ACCENT = hexToken('desk');

// The handle printed on the card: the site's own host, which follows
// public/CNAME (src/content/site.ts).
const SITE_HOST = new URL(SITE_URL).host;

// ── Fonts ─────────────────────────────────────────────────────────────────────

function fontDataUrl(path: string) {
  const data = readFileSync(path);
  return `data:font/woff2;base64,${data.toString('base64')}`;
}

const FONTS = {
  display: join(root, 'src/design/fonts/pixelify-sans-wght-latin.woff2'),
  text: join(root, 'src/design/fonts/ibm-plex-sans-wght-latin.woff2'),
};

const displayFontUrl = fontDataUrl(FONTS.display);
const textFontUrl = fontDataUrl(FONTS.text);

// ── Locales ───────────────────────────────────────────────────────────────────

const LOCALES = [
  { locale: 'es', role: 'Desarrollador web full-stack · Barcelona' },
  { locale: 'ca', role: 'Desenvolupador web full-stack · Barcelona' },
  { locale: 'en', role: 'Full-stack web developer · Barcelona' },
];

// ── Template ──────────────────────────────────────────────────────────────────

function buildHtml(role: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Pixelify Sans';
    src: url('${displayFontUrl}') format('woff2');
    font-weight: 400 700;
    font-style: normal;
  }
  @font-face {
    font-family: 'IBM Plex Sans';
    src: url('${textFontUrl}') format('woff2');
    font-weight: 400 600;
    font-style: normal;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: ${COLOR_PAPER};
    color: ${COLOR_INK};
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 64px 72px;
    overflow: hidden;
    position: relative;
  }
  .grid-line {
    position: absolute;
    top: 0;
    left: 72px;
    width: 1px;
    height: 100%;
    background: rgba(17,17,17,0.08);
  }
  .accent-bar {
    width: 48px;
    height: 5px;
    background: ${COLOR_ACCENT};
    margin-bottom: 28px;
  }
  .name {
    font-family: 'Pixelify Sans', monospace;
    font-weight: 700;
    font-size: 116px;
    line-height: 1.0;
    letter-spacing: -0.015em;
    text-transform: uppercase;
    color: ${COLOR_INK};
  }
  .role {
    font-family: 'IBM Plex Sans', sans-serif;
    font-weight: 400;
    font-size: 26px;
    line-height: 1.4;
    color: ${COLOR_INK_MUTED};
    margin-top: 20px;
  }
  .handle {
    position: absolute;
    top: 56px;
    right: 72px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-weight: 400;
    font-size: 18px;
    color: ${COLOR_ACCENT};
    letter-spacing: 0.02em;
  }
</style>
</head>
<body>
  <div class="grid-line"></div>
  <span class="handle">${SITE_HOST}</span>
  <div class="accent-bar"></div>
  <div class="name">Jesús García</div>
  <div class="role">${role}</div>
</body>
</html>`;
}

// ── Hash helper — skip regeneration if output is unchanged ───────────────────

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(join(root, 'public/og'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const { locale, role } of LOCALES) {
    const html = buildHtml(role);
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);

    // Render to a buffer first
    const buffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });

    const outPath = join(root, `public/og/${locale}.png`);
    const newHash = sha256(buffer);
    const changed =
      !existsSync(outPath) || sha256(readFileSync(outPath)) !== newHash;

    if (changed) {
      writeFileSync(outPath, buffer);
      console.log(`Updated public/og/${locale}.png (${Math.round(buffer.length / 1024)} KB)`);
    } else {
      console.log(`No change: public/og/${locale}.png`);
    }
  }

  await browser.close();
  console.log(`\nTokens used: paper=${COLOR_PAPER} ink=${COLOR_INK} ink-muted=${COLOR_INK_MUTED} accent=${COLOR_ACCENT}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
