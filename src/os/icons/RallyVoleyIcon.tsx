import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** Rally Voley: a volleyball, its panels drawn as three curved seam pairs. */
export function RallyVoleyIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="14.5" fill={C.white} {...OUTLINE} />
      <g fill="none" {...OUTLINE}>
        {[0, 120, 240].map((angle) => (
          <path
            key={angle}
            d="M20 20C17 14.5 17.4 9.6 20.6 5.6M28.6 8.4C25.6 12 25.2 16.4 27.4 21"
            transform={`rotate(${angle} 20 20)`}
          />
        ))}
      </g>
    </svg>
  );
}
