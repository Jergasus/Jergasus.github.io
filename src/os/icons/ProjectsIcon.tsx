import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** proyectos: a folder with the four project colours peeking out. */
export function ProjectsIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <path d="M5 8h10l3 3h17v22H5z" fill={C.white} {...OUTLINE} />
      <g {...OUTLINE} strokeWidth={2}>
        <rect x="8.5" y="12" width="6" height="12" fill={C.yellow} />
        <rect x="14.5" y="14" width="6" height="10" fill={C.pink} />
        <rect x="20.5" y="12" width="6" height="12" fill={C.green} />
        <rect x="26.5" y="14" width="5" height="10" fill={C.blue} />
      </g>
      <path d="M5 20.5h30V33H5z" fill={C.white} {...OUTLINE} />
    </svg>
  );
}
