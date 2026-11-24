import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** Yokaido: a paper lantern on its hook, ribbed, with a tassel. */
export function YokaidoIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M20 3v3.5M20 33.5v3.5" fill="none" {...OUTLINE} />
      <rect x="9" y="9" width="22" height="23" rx="10" fill={C.white} {...OUTLINE} />
      <path d="M10.6 15h18.8M9.4 20.5h21.2M10.6 26h18.8" fill="none" {...OUTLINE} strokeWidth={2} />
      <rect x="14" y="6" width="12" height="4.5" rx="1" fill={C.black} />
      <rect x="15" y="30.5" width="10" height="4" rx="1" fill={C.black} />
    </svg>
  );
}
