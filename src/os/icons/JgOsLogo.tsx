import { ICON_COLOURS as C } from './palette';

/**
 * The JG-OS mark: one JG-OS window (striped yellow titlebar, beige body,
 * black frame and hard shadow) holding "JG" in pixel letters. Drawn on whole
 * pixels of a 26 × 24 grid, so it stays crisp at 1×, 2× and up.
 *
 * src/app/icon.svg draws the same paths on a desk-blue tile (the favicon,
 * apple-icon and favicon.ico come from it: npm run icons);
 * src/content/icons.test.ts keeps the two in step.
 */
export const JG_OS_LOGO = {
  /** Window frame and its shadow, one black shape. */
  frame: 'M0 0h24v2h2v22H2v-2H0z',
  titlebar: 'M2 2h20v5H2z',
  stripes: 'M2 3h20v1H2zM2 5h20v1H2z',
  body: 'M2 9h20v11H2z',
  letters: 'M7 11h4v6h-1v1H6v-1H5v-2h2v1h2v-3H7zM14 11h5v2h-4v3h2v-1h-1v-1h3v3h-1v1h-4v-1h-1v-5h1z',
} as const;

/** `size` is the rendered width in CSS pixels; the height follows (26 : 24). */
export function JgOsLogo({ size = 26 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 26 24"
      width={size}
      height={(size * 24) / 26}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={JG_OS_LOGO.frame} fill={C.black} />
      <path d={JG_OS_LOGO.titlebar} fill={C.yellow} />
      <path d={JG_OS_LOGO.stripes} fill={C.black} fillOpacity={0.22} />
      <path d={JG_OS_LOGO.body} fill={C.window} />
      <path d={JG_OS_LOGO.letters} fill={C.black} />
    </svg>
  );
}
