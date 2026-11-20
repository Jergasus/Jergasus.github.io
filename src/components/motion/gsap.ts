import { gsap } from 'gsap';
import { installMotionDebug } from './debug';

// The one place GSAP is set up: every motion module imports it from here, so
// anything registered here (and the e2e recorder) is in place before it runs.
// JG-OS needs the core only; a plugin is registered here when one is used.

// Ruling R4: only e2e builds expose the recorder (Next inlines the variable).
if (process.env.NEXT_PUBLIC_E2E === '1' && typeof window !== 'undefined') {
  installMotionDebug(gsap);
}

export { gsap };
