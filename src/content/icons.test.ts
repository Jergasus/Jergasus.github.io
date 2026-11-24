/**
 * Task 13: the JG-OS artwork.
 *
 * - Every AppId has its own icon component, and each one draws a decorative
 *   40 × 40 SVG: aria-hidden, because the text chip next to it is the label.
 * - Every file in src/os/icons says aria-hidden itself, so a new icon cannot
 *   leak a nameless graphic into the accessibility tree.
 * - The site icon (src/app/icon.svg) draws the same mark as <JgOsLogo>.
 * - The Barcelona wallpaper is a small SVG and the token points at it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { apps } from '@/os/apps';
import { APP_ICONS, ICON_COLOURS } from '@/os/icons';
import { JgOsLogo } from '@/os/icons/JgOsLogo';

const root = process.cwd();
const ICON_DIR = path.join(root, 'src/os/icons');
const BARCELONA = path.join(root, 'public/wallpapers/barcelona.svg');
const BARCELONA_MAX = 15 * 1024;

const render = (component: Parameters<typeof createElement>[0]) =>
  renderToStaticMarkup(createElement(component));

const pathData = (markup: string) => [...markup.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

describe('app icons', () => {
  it('every AppId has an icon component, and only AppIds do', () => {
    expect(Object.keys(APP_ICONS).sort()).toEqual(apps.map((app) => app.id).sort());
    for (const app of apps) {
      expect(typeof APP_ICONS[app.id], app.id).toBe('function');
    }
  });

  it('each app has its own component', () => {
    expect(new Set(Object.values(APP_ICONS)).size).toBe(apps.length);
  });

  for (const app of apps) {
    it(`${app.id}: a decorative 40 × 40 SVG with no text of its own`, () => {
      const markup = render(APP_ICONS[app.id]);
      expect(markup.startsWith('<svg'), markup).toBe(true);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain('viewBox="0 0 40 40"');
      expect(markup).not.toMatch(/<(text|title)[\s>]/);
    });
  }

  it('the icon palette is the OS app palette', () => {
    const tokens = readFileSync(path.join(root, 'src/design/os-tokens.css'), 'utf8');
    for (const [name, hex] of Object.entries(ICON_COLOURS)) {
      if (name === 'black' || name === 'white') continue;
      const token = name === 'window' ? '--os-window' : `--os-c-${name}`;
      expect(tokens, name).toContain(`${token}: ${hex};`);
    }
  });

  it('every icon file contains aria-hidden', () => {
    const files = readdirSync(ICON_DIR).filter((name) => name.endsWith('.tsx'));
    expect(files.length).toBeGreaterThanOrEqual(apps.length);
    for (const name of files) {
      expect(readFileSync(path.join(ICON_DIR, name), 'utf8'), name).toContain('aria-hidden');
    }
  });
});

describe('JG-OS logo', () => {
  it('is decorative', () => {
    expect(render(JgOsLogo)).toContain('aria-hidden="true"');
  });

  it('the site icon draws the same mark on a desk-blue tile', () => {
    const svg = readFileSync(path.join(root, 'src/app/icon.svg'), 'utf8');
    const marks = pathData(render(JgOsLogo));
    expect(marks.length).toBeGreaterThan(0);
    for (const d of marks) expect(svg, d).toContain(`d="${d}"`);
    expect(svg.toLowerCase()).toContain('#5b7fa6');
  });
});

describe('Barcelona wallpaper', () => {
  it(`is an SVG under ${BARCELONA_MAX / 1024} KB`, () => {
    expect(statSync(BARCELONA).size).toBeLessThan(BARCELONA_MAX);
    expect(readFileSync(BARCELONA, 'utf8')).toMatch(/^<svg[\s>]/);
  });

  it('the wallpaper token points at it', () => {
    const tokens = readFileSync(path.join(root, 'src/design/os-tokens.css'), 'utf8');
    expect(tokens).toMatch(/--os-wp-barcelona:[^;]*url\(\/wallpapers\/barcelona\.svg\)/);
  });
});
