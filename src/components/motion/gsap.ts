import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import { installMotionDebug } from './debug';

// The one place GSAP is set up: every motion component imports it from here,
// so the plugins are registered once, before any of them runs.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// Ruling R4: only e2e builds expose the recorder (Next inlines the variable).
if (process.env.NEXT_PUBLIC_E2E === '1' && typeof window !== 'undefined') {
  installMotionDebug(gsap);
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
