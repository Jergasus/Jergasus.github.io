/** Delay before showing toasts when no boot ran (ms). */
export const NO_BOOT_DELAY_MS = 1200;
/** Delay after the boot screen clears before showing the first toast (ms). */
export const POST_BOOT_DELAY_MS = 100;
/** Delay when the welcome is open on first load (ms). */
export const WELCOME_DELAY_MS = 8000;

/**
 * Returns the ms from the desktop showing to the first toast.
 *
 * "The desktop showing" means: hydration (when no boot ran) or the moment the
 * boot screen clears (when it did). The welcome overrides both paths with a
 * static 8 s to give the visitor time to read the greeting.
 */
export function firstToastDelay(o: { boot: boolean; welcome: boolean }): number {
  if (o.welcome) return WELCOME_DELAY_MS;
  return o.boot ? POST_BOOT_DELAY_MS : NO_BOOT_DELAY_MS;
}
