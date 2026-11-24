/**
 * The colours the icons are drawn in: black outline, white fill and the OS app
 * palette (the --os-c-* tokens of src/design/os-tokens.css, which
 * src/content/icons.test.ts keeps in step). Literal hex rather than var(), so
 * the same markup also draws the OG images and the 404 page outside the OS.
 * App colours are the same by day and by night, so the icons need no theme.
 */
export const ICON_COLOURS = {
  black: '#111111',
  white: '#ffffff',
  /** The day window beige (--os-window), for the logo's window body. */
  window: '#ede7d9',
  yellow: '#ffd84d',
  pink: '#f2a7c3',
  green: '#b6e36b',
  blue: '#9db8ff',
  lilac: '#c9b8ff',
  peach: '#ffb38a',
  mint: '#9de0ad',
  sky: '#a9dcf2',
  cream: '#f4ecd2',
} as const;

/** Every icon takes its rendered size in CSS pixels; the art is 40 × 40. */
export type IconProps = { size?: number };

/** The outline every icon is drawn with: 2.5 units on the 40-unit grid. */
export const OUTLINE = {
  stroke: ICON_COLOURS.black,
  strokeWidth: 2.5,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;
