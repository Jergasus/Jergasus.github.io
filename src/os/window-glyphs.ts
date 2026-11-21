/**
 * The window buttons' 12 × 12 pixel glyphs, drawn on whole pixels so they stay
 * crisp. Shared by WindowFrame and the OG image script (scripts/generate-og.ts).
 */
export const WINDOW_GLYPHS = {
  minimize: 'M2 8h8v2H2z',
  maximize: 'M2 2h8v8H2zM4 5v3h4V5z',
  restore: 'M4 1h7v7H9V3H4zM1 4h7v7H1zM3 6v3h3V6z',
  close: 'M2 2h2v1h1v1h2V3h1V2h2v2H9v1H8v2h1v1h1v2H8V9H7V8H5v1H4v1H2V8h1V7h1V5H3V4H2z',
} as const;
