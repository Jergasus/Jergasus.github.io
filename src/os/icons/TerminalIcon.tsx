import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** terminal: a dark screen with a prompt and a cursor. */
export function TerminalIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="5" y="7" width="30" height="26" rx="2" fill={C.ink} {...OUTLINE} />
      <path d="M5 13h30" fill="none" stroke={C.white} strokeWidth={1.5} />
      <path d="M11 18l5.5 4.5-5.5 4.5" fill="none" {...OUTLINE} stroke={C.mint} />
      <path d="M19.5 27.5h8" fill="none" {...OUTLINE} stroke={C.cream} />
    </svg>
  );
}
