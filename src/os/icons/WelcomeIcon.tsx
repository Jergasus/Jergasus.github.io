import { ICON_COLOURS as C, type IconProps } from './palette';

// Light outline — the tile is dark (grey), so the shared
// OUTLINE (black stroke) would barely show; use white/beige instead.
const LIGHT = {
  stroke: C.white,
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

/** bienvenida.txt: a text file with a folded corner. */
export function WelcomeIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      {/* File body — white on the grey tile */}
      <path d="M9 5h15l7 7v23H9z" fill={C.white} {...LIGHT} />
      {/* Folded corner */}
      <path d="M24 5v7h7" fill="none" {...LIGHT} />
      {/* Text lines — dark on the white file body */}
      <path d="M13 19h14M13 23.5h14M13 28h8" fill="none" stroke={C.black} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
