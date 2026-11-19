import { useSyncExternalStore } from 'react';
import { REDUCED_MOTION, prefersReducedMotion } from '@/design/motion';

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
const readClient = () => !prefersReducedMotion();
// The server render and the hydration pass are the final, static state.
const readServer = () => false;

/**
 * Whether the motion layer may animate. False under
 * `prefers-reduced-motion: reduce` and before hydration, so the server HTML
 * (what no-JS visitors get) is always the finished page; it follows the
 * preference live if the visitor changes it.
 */
export function useMotionSafe(): { enabled: boolean } {
  return { enabled: useSyncExternalStore(subscribe, readClient, readServer) };
}
