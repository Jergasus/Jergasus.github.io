import localFont from 'next/font/local';

/*
 * JG-OS typefaces, self-hosted (SIL OFL 1.1, licences in ./fonts), Latin
 * subset: covers Spanish and Catalan (à è é í ï ò ó ú ü ç ñ, l·l). Each
 * `.variable` class declares one font variable; os-tokens.css reads them as
 * --os-font-pixel, --os-font-sans and --os-font-mono. Every root document
 * puts all three on <html> (osFontVariables).
 */

/**
 * VT323 (weight 400 only): window titles, taskbar and OS chrome.
 *
 * size-adjust: 125% compensates for VT323's narrower metrics — it renders
 * ~20-25% smaller than Pixelify Sans at the same font-size. The multiplier
 * restores the original visual weight without touching every size declaration.
 * font-synthesis-weight: none in os.css prevents faux-bold synthesis.
 */
export const osPixelFont = localFont({
  src: './fonts/vt323-400-latin.woff2',
  weight: '400',
  variable: '--font-os-pixel',
  fallback: ['monospace'],
  adjustFontFallback: false,
  declarations: [{ prop: 'size-adjust', value: '125%' }],
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
