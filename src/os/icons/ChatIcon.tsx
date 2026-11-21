import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** The dock's WhatsApp button: a plain speech bubble (no brand artwork). */
export function ChatIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M8 7h24a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H18l-7.5 6v-6H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z" fill={C.white} {...OUTLINE} />
      <g fill={C.ink}>
        <circle cx="13.5" cy="17.5" r="2.2" />
        <circle cx="20" cy="17.5" r="2.2" />
        <circle cx="26.5" cy="17.5" r="2.2" />
      </g>
    </svg>
  );
}
