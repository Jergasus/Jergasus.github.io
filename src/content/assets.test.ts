/**
 * Task 7 — asset coverage tests.
 *
 * Checks that every project with preview !== null has its AVIF and WebP files
 * present under public/ and within the agreed size limits, that Yokaido has
 * preview === null, and that the about-photo files exist.
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { projects } from './projects';

const root = path.resolve(process.cwd());

function fileSize(rel: string): number {
  return statSync(path.join(root, rel)).size;
}

// Size limits from the brief
const PREVIEW_AVIF_MAX = 250 * 1024; // 250 KB
const PREVIEW_WEBP_MAX = 400 * 1024; // 400 KB
const ABOUT_AVIF_MAX = 120 * 1024;   // 120 KB

describe('project preview assets', () => {
  it('yokaido has preview === null', () => {
    const yokaido = projects.find((p) => p.slug === 'yokaido');
    expect(yokaido?.preview).toBeNull();
  });

  for (const project of projects.filter((p) => p.preview !== null)) {
    const { slug, preview } = project;

    it(`${slug}: preview.avif path matches public/ file`, () => {
      expect(preview!.avif).toBe(`/previews/${slug}.avif`);
      expect(() => fileSize(`public${preview!.avif}`)).not.toThrow();
    });

    it(`${slug}: preview.webp path matches public/ file`, () => {
      expect(preview!.webp).toBe(`/previews/${slug}.webp`);
      expect(() => fileSize(`public${preview!.webp}`)).not.toThrow();
    });

    it(`${slug}: AVIF ≤ 250 KB`, () => {
      const size = fileSize(`public${preview!.avif}`);
      expect(size).toBeLessThanOrEqual(PREVIEW_AVIF_MAX);
    });

    it(`${slug}: WebP ≤ 400 KB`, () => {
      const size = fileSize(`public${preview!.webp}`);
      expect(size).toBeLessThanOrEqual(PREVIEW_WEBP_MAX);
    });
  }
});

describe('about photo assets', () => {
  it('public/about/jesus-garcia.avif exists and ≤ 120 KB', () => {
    const size = fileSize('public/about/jesus-garcia.avif');
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThanOrEqual(ABOUT_AVIF_MAX);
  });

  it('public/about/jesus-garcia.webp exists', () => {
    expect(() => fileSize('public/about/jesus-garcia.webp')).not.toThrow();
  });
});
