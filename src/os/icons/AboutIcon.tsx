import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** sobre_mi.txt: a text file with a folded corner, a small portrait and lines. */
export function AboutIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M9 5h15l7 7v23H9z" fill={C.white} {...OUTLINE} />
      <path d="M24 5v7h7" fill="none" {...OUTLINE} />
      <circle cx="16.5" cy="13" r="3" fill={C.lilac} {...OUTLINE} strokeWidth={2} />
      <path d="M12 21.5c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4" fill={C.lilac} {...OUTLINE} strokeWidth={2} />
      <path d="M13 26h14M13 30.5h10" fill="none" {...OUTLINE} />
    </svg>
  );
}
