import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** actividad: a monitor panel with one commit bar per project colour. */
export function ActivityIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x="5" y="7" width="30" height="26" rx="2" fill={C.white} {...OUTLINE} />
      <g {...OUTLINE} strokeWidth={2}>
        <rect x="9.5" y="20" width="4.5" height="9" fill={C.yellow} />
        <rect x="15.5" y="13" width="4.5" height="16" fill={C.pink} />
        <rect x="21.5" y="17" width="4.5" height="12" fill={C.green} />
        <rect x="27.5" y="11" width="3.5" height="18" fill={C.blue} />
      </g>
    </svg>
  );
}
