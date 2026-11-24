import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** The 404 dialog's glyph: a file drawn in dashes, with a question mark. */
export function MissingFileIcon({ size = 56 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M9 5h15l7 7v23H9z" fill={C.white} {...OUTLINE} strokeDasharray="3.2 2.6" />
      <path d="M24 5v7h7" fill="none" {...OUTLINE} />
      <path d="M16.5 18.2a3.6 3.6 0 1 1 5.2 3.2c-1.2.6-1.7 1.4-1.7 2.6v.8" fill="none" {...OUTLINE} />
      <circle cx="20" cy="29.2" r="1.6" fill={C.black} />
    </svg>
  );
}
