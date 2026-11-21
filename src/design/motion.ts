/**
 * Motion presets: the only place JG-OS motion timing lives (spec §6.4).
 *
 * Snappy and retro, never slow or floaty. Durations are in seconds (GSAP
 * units); eases are GSAP ease names. The sequences themselves live in
 * src/os/shell/motion.ts; the boot's CSS reads bootLine through a custom
 * property (src/os/shell/BootScreen.tsx).
 */
export const motion = {
  os: {
    /** A dashed outline grows from the icon or taskbar button to the window, then the window appears. */
    open: { duration: 0.28, ease: 'power3.out' },
    /** The window goes at once; the outline shrinks back to where it came from. */
    close: { duration: 0.18, ease: 'power2.in' },
    /** The window scales toward its taskbar button. */
    minimize: { duration: 0.24, ease: 'power3.inOut' },
    /** A phone app grows from its icon. */
    phoneApp: { duration: 0.32, ease: 'back.out(1.4)' },
    /** A phone app closes back into its icon (no overshoot on the way out). */
    phoneClose: { duration: 0.24, ease: 'power3.in' },
    /** A notification slides in from the edge of the screen. */
    toast: { duration: 0.3, ease: 'power3.out' },
    /** Seconds between boot lines. */
    bootLine: 0.22,
  },
} as const;

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
