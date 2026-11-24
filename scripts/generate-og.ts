/**
 * One-time script to generate the OG images (1200×630) for each locale, in
 * the JG-OS look: the desk with its dots, the four project icons, the
 * taskbar, and one window titled with the localised about filename
 * (sobre_mi.txt, about_me.txt) holding the name and the lede.
 *
 * Playwright (already a devDependency) screenshots an HTML page drawn at the
 * OS's own sizes (600×315 CSS px) at device scale 2, so every 2 px border and
 * 4 px shadow lands on whole pixels, as on a retina screen.
 *
 * Everything is the site's own: the colours are the --os-* tokens of the day
 * :root block of src/design/os-tokens.css (passed through as CSS variables),
 * the words come from messages/{es,ca,en}.json, the icons and the logo are
 * the React components in src/os/icons, and the fonts are the self-hosted
 * files in src/design/fonts. Change any of them and re-run.
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
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SITE_NAME } from '../src/content/site';
import type { AppId } from '../src/os/apps';
import { getApp } from '../src/os/apps';
import { APP_ICONS, JgOsLogo } from '../src/os/icons';
import { WINDOW_GLYPHS } from '../src/os/window-glyphs';

const root = new URL('..', import.meta.url).pathname;

// ── Tokens ───────────────────────────────────────────────────────────────────

/**
 * Every `--os-*: <value>;` declaration of the first (day) :root block of
 * os-tokens.css, comments stripped. Returns token name → raw value.
 */
function parseTokens(cssPath: string): Record<string, string> {
  const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const day = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? '';
  const tokens: Record<string, string> = {};
  for (const match of day.matchAll(/--os-([\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const tokens = parseTokens(join(root, 'src/design/os-tokens.css'));

/** The card uses these; a missing one stops the script rather than drawing a guess. */
const REQUIRED = [
  'desk', 'window', 'ink', 'border', 'shadow', 'wp-dots', 'c-lilac', 'border-w', 'shadow-offset', 'radius-icon',
  'icon-ink', 'icon-outline',
];
for (const name of REQUIRED) {
  if (!tokens[name]) throw new Error(`src/design/os-tokens.css: --os-${name} is missing from the day :root block`);
}
const tokenCss = Object.entries(tokens)
  // The font tokens point at next/font variables that do not exist here.
  .filter(([name]) => !name.startsWith('font-'))
  .map(([name, value]) => `--os-${name}: ${value};`)
  .join('\n    ');

// ── Fonts ────────────────────────────────────────────────────────────────────

const font = (file: string) =>
  `data:font/woff2;base64,${readFileSync(join(root, 'src/design/fonts', file)).toString('base64')}`;
const PIXEL = font('vt323-400-latin.woff2');
const SANS = font('ibm-plex-sans-wght-latin.woff2');

// ── Words ────────────────────────────────────────────────────────────────────

type Messages = {
  hero: { lede: string };
  os: {
    taskbar: { start: string };
    apps: Record<string, { title: string; label: string }>;
  };
};

const messages = (locale: string): Messages =>
  JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'));

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const svg = (component: ComponentType<{ size?: number }>, size: number) =>
  renderToStaticMarkup(createElement(component, { size }));

const colour = (id: AppId) => `var(--os-c-${getApp(id)!.colour})`;

// ── Template ─────────────────────────────────────────────────────────────────

const LOCALES = ['es', 'ca', 'en'] as const;
const DESK_ICONS: AppId[] = ['questday', 'sakurai', 'rally-voley', 'yokaido'];

function buildHtml(locale: (typeof LOCALES)[number]): string {
  const m = messages(locale);
  const about = m.os.apps.about;
  const label = (id: AppId) => escape(m.os.apps[getApp(id)!.messageKey].label);

  const icons = DESK_ICONS.map(
    (id) => `
      <div class="icon">
        <span class="tile" style="--app: ${colour(id)}">${svg(APP_ICONS[id], 34)}</span>
        <span class="label">${label(id)}</span>
      </div>`,
  ).join('');

  const glyph = (d: string) =>
    `<span class="btn"><svg viewBox="0 0 12 12" width="12" height="12" shape-rendering="crispEdges"><path d="${d}" fill="currentColor" fill-rule="evenodd"/></svg></span>`;

  const languages = LOCALES.map(
    (code) => `<span class="lang${code === locale ? ' current' : ''}">${code.toUpperCase()}</span>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'VT323'; src: url('${PIXEL}') format('woff2'); font-weight: 400; }
  @font-face { font-family: 'IBM Plex Sans'; src: url('${SANS}') format('woff2'); font-weight: 400 600; }
  :root {
    ${tokenCss}
    --pixel: 'VT323', monospace;
    --sans: 'IBM Plex Sans', sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    position: relative;
    width: 600px;
    height: 315px;
    overflow: hidden;
    color: var(--os-ink);
    background: var(--os-wp-dots);
    font-family: var(--sans);
  }
  svg { display: block; }

  /* Desktop icons: the four projects, top left. */
  .icons {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    gap: 4px;
    justify-items: center;
    width: 88px;
  }
  .icon { display: grid; gap: 3px; justify-items: center; }
  .tile {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    background: var(--app);
    border: var(--os-border-w) solid var(--os-border);
    border-radius: var(--os-radius-icon);
    box-shadow: 2px 2px 0 var(--os-shadow);
  }
  /* Icon names sit straight on the wallpaper, outlined, as on the site. */
  .label {
    padding: 1px 4px;
    font: 400 14px/1.2 var(--pixel);
    color: var(--os-icon-ink);
    text-shadow: var(--os-icon-outline);
  }

  /* The window. */
  .win {
    position: absolute;
    top: 40px;
    left: 122px;
    width: 446px;
    background: var(--os-window);
    border: var(--os-border-w) solid var(--os-border);
    box-shadow: var(--os-shadow-offset) var(--os-shadow-offset) 0 var(--os-shadow);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 1px 3px 1px 8px;
    color: #111111;
    background-color: var(--os-c-lilac);
    background-image: repeating-linear-gradient(to bottom, transparent 0 2px, rgb(0 0 0 / 0.18) 2px 3px);
    border-bottom: var(--os-border-w) solid var(--os-border);
    font: 400 19px/1 var(--pixel);
  }
  .patch { display: flex; align-items: center; gap: 6px; padding: 3px 6px 3px 4px; background: var(--os-c-lilac); }
  .grow { flex: 1; }
  .btns { display: flex; gap: 3px; }
  .btn {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: #111111;
    background: var(--os-c-cream);
    border: var(--os-border-w) solid #111111;
  }
  .body { padding: 20px 22px 24px; }
  .name {
    font: 400 52px/1.05 var(--pixel);
    letter-spacing: 0.01em;
  }
  .lede {
    max-width: 30em;
    margin-top: 12px;
    font: 400 15.5px/1.45 var(--sans);
  }

  /* The taskbar. */
  .taskbar {
    position: absolute;
    inset: auto 0 0;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding-inline: 4px 10px;
    background: var(--os-window);
    border-top: var(--os-border-w) solid var(--os-border);
    font-family: var(--pixel);
  }
  .start {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 2px 10px 2px 6px;
    font: 400 19px/1 var(--pixel);
    border: var(--os-border-w) solid var(--os-border);
  }
  .task {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px 0 5px;
    font: 400 16px/1 var(--pixel);
    color: #111111;
    background: var(--os-c-lilac);
    border: var(--os-border-w) solid var(--os-border);
    box-shadow: inset 1px 1px 0 rgb(0 0 0 / 0.5), inset -1px -1px 0 rgb(0 0 0 / 0.25);
  }
  .tray { margin-left: auto; display: flex; gap: 4px; }
  .lang { padding: 2px 6px; font: 400 15px/1 var(--pixel); border: var(--os-border-w) solid transparent; }
  .lang.current { border-color: currentColor; }
</style>
</head>
<body>
  <div class="icons">${icons}
  </div>

  <div class="win">
    <div class="bar">
      <span class="patch">${svg(APP_ICONS.about, 18)}<span>${escape(about.title)}</span></span>
      <span class="grow"></span>
      <span class="btns">${glyph(WINDOW_GLYPHS.minimize)}${glyph(WINDOW_GLYPHS.maximize)}${glyph(WINDOW_GLYPHS.close)}</span>
    </div>
    <div class="body">
      <div class="name">${escape(SITE_NAME)}</div>
      <p class="lede">${escape(m.hero.lede)}</p>
    </div>
  </div>

  <div class="taskbar">
    <span class="start">${svg(JgOsLogo, 22)}${escape(m.os.taskbar.start)}</span>
    <span class="task">${svg(APP_ICONS.about, 18)}${escape(about.label)}</span>
    <span class="tray">${languages}</span>
  </div>
</body>
</html>`;
}

// ── Hash helper — skip regeneration if output is unchanged ───────────────────

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(join(root, 'public/og'), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 600, height: 315 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const locale of LOCALES) {
    await page.setContent(buildHtml(locale), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 600, height: 315 } });

    const outPath = join(root, `public/og/${locale}.png`);
    const changed = !existsSync(outPath) || sha256(readFileSync(outPath)) !== sha256(buffer);
    if (changed) {
      writeFileSync(outPath, buffer);
      console.log(`Updated public/og/${locale}.png (${Math.round(buffer.length / 1024)} KB)`);
    } else {
      console.log(`No change: public/og/${locale}.png`);
    }
  }

  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
