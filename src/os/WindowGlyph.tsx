import { WINDOW_GLYPHS } from './window-glyphs';

/** A window button's 12 × 12 pixel glyph (minimise, maximise, restore, close). */
export function WindowGlyph({ kind }: { kind: keyof typeof WINDOW_GLYPHS }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d={WINDOW_GLYPHS[kind]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
