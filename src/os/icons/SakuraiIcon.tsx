import { ICON_COLOURS as C, OUTLINE, type IconProps } from './palette';

/** One cherry-blossom petal, pointing up, with the notch at its tip. */
const PETAL = 'M20 20.5C14.2 18.2 12.6 10.6 16.6 6.2L20 8.8l3.4-2.6c4 4.4 2.4 12-3.4 14.3z';

/** SakurAI: a five-petal cherry blossom with a yellow heart. */
export function SakuraiIcon({ size = 36 }: IconProps) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill={C.white} {...OUTLINE}>
        {[0, 72, 144, 216, 288].map((angle) => (
          <path key={angle} d={PETAL} transform={`rotate(${angle} 20 21)`} />
        ))}
      </g>
      <circle cx="20" cy="21" r="4" fill={C.yellow} {...OUTLINE} />
    </svg>
  );
}
