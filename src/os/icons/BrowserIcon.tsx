import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** navegador: a window with an address bar, showing a globe. */
export function BrowserIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="5" y="6" width="30" height="28" rx="2" fill={C.white} {...OUTLINE} />
      <path d="M5 13h30" fill="none" {...OUTLINE} />
      <rect x="9" y="8.4" width="22" height="2.4" rx="1.2" fill={C.sky} stroke={C.black} strokeWidth={1.5} />
      <circle cx="20" cy="23.5" r="7" fill={C.sky} {...OUTLINE} strokeWidth={2} />
      <path d="M13 23.5h14M20 16.5c-3.6 4-3.6 10 0 14M20 16.5c3.6 4 3.6 10 0 14" fill="none" {...OUTLINE} strokeWidth={2} />
    </svg>
  );
}
