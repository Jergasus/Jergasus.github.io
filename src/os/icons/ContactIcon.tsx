import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** contacto (and the dock's mail button): an envelope with a wax seal. */
export function ContactIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="5" y="9" width="30" height="22" rx="2" fill={C.white} {...OUTLINE} />
      <path d="M6 10.5l14 11 14-11M6 29.5l10.5-9.5M34 29.5L23.5 20" fill="none" {...OUTLINE} />
      <circle cx="20" cy="21.5" r="3.6" fill={C.pink} {...OUTLINE} strokeWidth={2} />
    </svg>
  );
}
