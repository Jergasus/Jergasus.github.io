import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** personalizar: a painter's palette with four colours and a thumb hole. */
export function SettingsIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M20 6c8.4 0 14.5 5.6 14.5 12.4 0 4.4-3.4 6.1-6.6 5.1-3-.9-5 1.2-4 4.1 1.1 3.3-1 6.4-4.6 6.4C11.6 34 5.5 28 5.5 20S11.6 6 20 6z"
        fill={C.white}
        {...OUTLINE}
      />
      <g {...OUTLINE} strokeWidth={2}>
        <circle cx="12.5" cy="17" r="2.8" fill={C.pink} />
        <circle cx="19" cy="12" r="2.8" fill={C.yellow} />
        <circle cx="26.5" cy="13.5" r="2.8" fill={C.blue} />
        <circle cx="13" cy="25.5" r="2.8" fill={C.peach} />
      </g>
    </svg>
  );
}
