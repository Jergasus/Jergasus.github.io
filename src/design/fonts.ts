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
