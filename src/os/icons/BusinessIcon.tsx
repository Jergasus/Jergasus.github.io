import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** nuevo_proyecto: a briefcase with a "new" plus badge. */
export function BusinessIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M14.5 12V8.5h11V12" fill="none" {...OUTLINE} />
      <rect x="5" y="12" width="30" height="20" rx="2.5" fill={C.white} {...OUTLINE} />
      <path d="M5 20.5h30" fill="none" {...OUTLINE} />
      <rect x="17.5" y="18" width="5" height="5" fill={C.peach} {...OUTLINE} strokeWidth={2} />
      <circle cx="29.5" cy="29.5" r="6" fill={C.yellow} {...OUTLINE} />
      <path d="M29.5 26.5v6M26.5 29.5h6" fill="none" {...OUTLINE} />
    </svg>
  );
}
