import localFont from 'next/font/local';

/*
 * Self-hosted faces (SIL OFL 1.1, licences in ./fonts), Latin subset: covers
 * Spanish and Catalan (à è é í ï ò ó ú ü ç ñ, l·l). Each `.variable` class
 * declares one of the font tokens; the root layouts put all three on <html>.
 */

export const displayFont = localFont({
  src: './fonts/big-shoulders-display-800-latin.woff2',
  weight: '800',
  variable: '--font-display',
  fallback: ['sans-serif'],
});

export const textFont = localFont({
  src: './fonts/schibsted-grotesk-wght-latin.woff2',
  weight: '400 900',
  variable: '--font-text',
  fallback: ['sans-serif'],
});

export const monoFont = localFont({
  src: './fonts/fragment-mono-400-latin.woff2',
  weight: '400',
  variable: '--font-mono',
  fallback: ['ui-monospace', 'monospace'],
  adjustFontFallback: false,
});

/*
 * JG-OS typefaces (SIL OFL 1.1, licences in ./fonts).
 * Not applied to any page until Task 5; exported here so Task 5 can import
 * and add the .variable class names to <html> without further changes here.
 */

/** Pixelify Sans (wght 400–700) — OS chrome display text, pixel aesthetic. */
export const osPixelFont = localFont({
  src: './fonts/pixelify-sans-wght-latin.woff2',
  weight: '400 700',
  variable: '--font-os-pixel',
  fallback: ['monospace'],
  adjustFontFallback: false,
});

/** IBM Plex Sans (wght 400–600) — OS UI body and label text. */
export const osSansFont = localFont({
  src: './fonts/ibm-plex-sans-wght-latin.woff2',
  weight: '400 600',
  variable: '--font-os-sans',
  fallback: ['sans-serif'],
});

/** IBM Plex Mono (400 and 500) — OS monospace / data display. */
export const osMonoFont = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500-latin.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-os-mono',
  fallback: ['ui-monospace', 'monospace'],
  adjustFontFallback: false,
});
