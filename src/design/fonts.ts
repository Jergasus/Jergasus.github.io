import localFont from 'next/font/local';

/*
 * JG-OS typefaces, self-hosted (SIL OFL 1.1, licences in ./fonts), Latin
 * subset: covers Spanish and Catalan (à è é í ï ò ó ú ü ç ñ, l·l). Each
 * `.variable` class declares one font variable; os-tokens.css reads them as
 * --os-font-pixel, --os-font-sans and --os-font-mono. Every root document
 * puts all three on <html> (osFontVariables).
 */

/** Pixelify Sans (wght 400–700): window titles, taskbar and OS chrome. */
export const osPixelFont = localFont({
  src: './fonts/pixelify-sans-wght-latin.woff2',
  weight: '400 700',
  variable: '--font-os-pixel',
  fallback: ['monospace'],
  adjustFontFallback: false,
});

/** IBM Plex Sans (wght 400–600): long-form text (case studies, bio). */
export const osSansFont = localFont({
  src: './fonts/ibm-plex-sans-wght-latin.woff2',
  weight: '400 600',
  variable: '--font-os-sans',
  fallback: ['sans-serif'],
});

/** IBM Plex Mono (400 and 500): data, labels and code. */
export const osMonoFont = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500-latin.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-os-mono',
  fallback: ['ui-monospace', 'monospace'],
  adjustFontFallback: false,
});

/** The three variable classes, for the className of every root <html>. */
export const osFontVariables = [osPixelFont.variable, osSansFont.variable, osMonoFont.variable].join(' ');
