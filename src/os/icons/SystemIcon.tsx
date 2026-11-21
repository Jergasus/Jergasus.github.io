import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** propiedades del sistema: the machine's processor chip, pins on every side. */
export function SystemIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M15 6.5v4M20 6.5v4M25 6.5v4M15 29.5v4M20 29.5v4M25 29.5v4M6.5 15h4M6.5 20h4M6.5 25h4M29.5 15h4M29.5 20h4M29.5 25h4"
        fill="none"
        {...OUTLINE}
      />
      <rect x="10.5" y="10.5" width="19" height="19" rx="2.5" fill={C.white} {...OUTLINE} />
      <rect x="15.5" y="15.5" width="9" height="9" rx="1" fill={C.yellow} {...OUTLINE} strokeWidth={2} />
    </svg>
  );
}
