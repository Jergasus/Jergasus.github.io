import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** QuestDay: a puzzle piece, knobs up and right, a socket on the left. */
export function QuestDayIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M7 13.5h6.5a4.2 4.2 0 1 1 7.4 0H28v7a4.2 4.2 0 1 1 0 7.4V34H7v-6.1a4.2 4.2 0 1 0 0-7.4z"
        fill={C.white}
        {...OUTLINE}
      />
    </svg>
  );
}
