/**
 * Motion presets: the only place GSAP timing lives (spec §5.1).
 *
 * Editorial Brutalism moves like a shutter: a strong in-out curve for the
 * page load's masked lines and drawn rules, a long expo tail for things that
 * settle and for reveals the visitor's scroll sets off.
 * Durations are in seconds (GSAP units). CSS hover and press transitions use
 * the matching --ease-* and --duration-ui tokens in tokens.css.
 */
export const motion = {
  ease: {
    out: 'expo.out',
    inOut: 'power4.inOut',
  },
  duration: {
    fast: 0.45, // index rows, small reveals
    base: 0.8, // rules drawing in, headline lines
    slow: 1.1, // the hero name (the case-page transition is CSS: --duration-page)
  },
  stagger: {
    rows: 0.08, // index rows sweep in as one gesture
    lines: 0.1, // each headline line gets its own beat
  },
  /**
   * The page-load sequence (src/components/motion/PageLoad.tsx): when each
   * beat starts, in seconds from the start. The rules draw in at 0; every
   * later beat starts before the previous one settles, so the load reads as
   * one gesture: the frame, then the name, then what fills it.
   */
  load: {
    lines: 0.15, // the name rises while the rules are still drawing
    content: 0.7, // the lede and the data strip settle under it
    rows: 0.9, // then the project index
    // The server HTML paints before the page comes alive. If that takes
    // longer than this after the first paint (measured: ~0.1s on desktop
    // broadband, ~0.23s on fast 4G, ~1.3s on slow 4G), the visitor has
    // already seen the first screen in place, and hiding it to replay would
    // read as a glitch, so it stays as it is.
    latest: 0.15,
  },
  /** Scroll reveals (src/components/motion/Reveal.tsx). */
  reveal: {
    at: 0.85, // a block reveals once its top passes 85% of the viewport height
    items: 0.2, // its items follow once the heading has visibly landed (expo.out)
  },
  /** Distance in px an item travels as it settles into place. */
  settle: 16,
};

/**
 * Transition type for links that open a case page (work rows, a case page's
 * previous/next links). Next 16 passes it to React's <ViewTransition>, which
 * animates only navigations carrying it; the curve and timing are CSS
 * (globals.css, --duration-page), since the browser runs the animation.
 */
export const CASE_OPEN = 'case-open';

/** Cursor-following preview: share of the remaining distance covered per 60 fps frame. */
export const previewFollow = {
  lerp: 0.14,
};

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * Client-only check for `prefers-reduced-motion: reduce`.
 * Without `matchMedia` (server, very old browsers) it answers true, so an
 * unknown environment gets the static version.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(REDUCED_MOTION).matches;
}
