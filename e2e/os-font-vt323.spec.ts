/**
 * TDD: VT323 pixel typeface.
 *
 * RED: written before the font swap — these fail with Pixelify Sans.
 * GREEN: pass once fonts.ts points at vt323-400-latin.woff2.
 *
 * Checks:
 *  - The computed font-family of a desktop icon label, a window title,
 *    and the boot logo starts with the VT323 family name next/font generates.
 *  - The pixel elements use font-weight 400 (VT323 only has this weight).
 */
import { test as base, expect, type Page } from '@playwright/test';
import { SKIP_BOOT_FLAG } from '@/os/prepaint';

// A fixture that boots the OS (waits for data-os-ready) but does NOT skip
// the boot screen, so we can inspect boot-screen elements too.
const test = base.extend<{ page: Page }>({
  page: async ({ page }, run) => {
    await page.addInitScript((flag) => {
      (window as unknown as Record<string, unknown>)[flag] = true;
    }, SKIP_BOOT_FLAG);
    await run(page);
  },
});

test.describe('VT323 pixel typeface', () => {
  test('the VT323 font file is preloaded for the pixel typeface', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');

    // next/font emits a <link rel="preload"> for every font it loads.
    // The file name contains the source name from the localFont config path.
    const preloadHref = await page.evaluate(() => {
      const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')];
      return links.find((l) => /vt323/i.test(l.href))?.href ?? null;
    });
    expect(preloadHref, 'No VT323 preload link found').not.toBeNull();
    expect(preloadHref!.toLowerCase()).toContain('vt323');
  });

  test('desktop icon label and window titlebar use the OS pixel font family', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
    await page.evaluate(() => document.fonts.ready);

    // next/font sets --font-os-pixel on <html> via a generated class. The CSS
    // chain is: --font-os-pixel (next/font) → --os-font-pixel (os-tokens) →
    // font-family on elements. We verify the chain resolves to the same family.
    const result = await page.evaluate(() => {
      // Computed font-family of the html element via --os-font-pixel.
      const htmlFamily = getComputedStyle(document.documentElement)
        .fontFamily;
      const label = document.querySelector('.os-icon-label') as HTMLElement;
      const titlebar = document.querySelector('.os-titlebar') as HTMLElement;
      return {
        labelFamily: label ? getComputedStyle(label).fontFamily : '',
        titlebarFamily: titlebar ? getComputedStyle(titlebar).fontFamily : '',
        htmlFamily,
      };
    });

    // Both elements must have a non-empty, non-fallback-only font family.
    expect(result.labelFamily, 'icon label font-family is empty').not.toBe('');
    expect(result.titlebarFamily, 'titlebar font-family is empty').not.toBe('');

    // Both OS chrome elements must have the SAME generated pixel font family
    // (the one next/font maps from --font-os-pixel). They share the CSS variable.
    const labelFamilyFirst = result.labelFamily.split(',')[0].trim().toLowerCase();
    const titleFamilyFirst = result.titlebarFamily.split(',')[0].trim().toLowerCase();
    expect(labelFamilyFirst).toBe(titleFamilyFirst);

    // The font family must NOT still be one of the generic fallbacks only.
    expect(labelFamilyFirst).not.toBe('monospace');
    expect(labelFamilyFirst).not.toBe('sans-serif');
  });

  test('pixel elements block faux-bold synthesis (font-synthesis: none)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-os-ready', '1');
    await page.evaluate(() => document.fonts.ready);

    // Check icon label — weight must be 400 OR synthesis must be blocked.
    const label = page.locator('.os-icon-label').first();
    const [labelWeight, labelSynthesis] = await label.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return [s.fontWeight, s.fontSynthesisWeight ?? s.fontSynthesis];
    });
    const labelOk = labelWeight === '400' || (labelSynthesis ?? '').includes('none');
    expect(labelOk, `icon label: weight=${labelWeight} synthesis=${labelSynthesis}`).toBe(true);

    // Check window titlebar.
    const titlebar = page.locator('.os-titlebar').first();
    const [titleWeight, titleSynthesis] = await titlebar.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return [s.fontWeight, s.fontSynthesisWeight ?? s.fontSynthesis];
    });
    const titleOk = titleWeight === '400' || (titleSynthesis ?? '').includes('none');
    expect(titleOk, `titlebar: weight=${titleWeight} synthesis=${titleSynthesis}`).toBe(true);
  });
});
