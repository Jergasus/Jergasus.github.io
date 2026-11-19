'use client';

import { useRef, type ReactNode } from 'react';
import { motion, prefersReducedMotion } from '@/design/motion';
import { recordPlayed } from './debug';
import { gsap, useGSAP } from './gsap';
import { useMotionSafe } from './useMotionSafe';

// One page-load sequence per document: the first PageLoad set up after a full
// load owns it. Views reached by client navigation (a work row, the back
// button) never replay it; the view transition moves them instead.
let loadClaimed = false;

type Props = {
  /** Names the sequence for the e2e recorder ('home', 'case'). */
  name: string;
  children: ReactNode;
};

// Where the first screen will start, in px from the top of the document. A
// link to /#work lands on the index, but the browser may only jump there
// after this runs, so the URL's target counts, not the current scroll.
function landing(): number {
  let target: HTMLElement | null = null;
  try {
    const id = decodeURIComponent(window.location.hash.slice(1));
    target = id ? document.getElementById(id) : null;
  } catch {
    // A malformed hash lands nowhere in particular.
  }
  return window.scrollY + (target?.getBoundingClientRect().top ?? 0);
}

// An element's box relative to that first screen.
function onFirstScreen(element: Element, top: number) {
  const box = element.getBoundingClientRect();
  return box.bottom + window.scrollY > top && box.top + window.scrollY < top + window.innerHeight;
}
const aboveFirstScreen = (element: Element, top: number) =>
  element.getBoundingClientRect().bottom + window.scrollY <= top;

// Seconds the server HTML has been on screen (0 where Paint Timing is missing).
function shownFor(): number {
  const paint = performance.getEntriesByName('first-contentful-paint')[0];
  return paint ? (performance.now() - paint.startTime) / 1000 : 0;
}

/**
 * The page-load sequence, in beats (timing in src/design/motion.ts):
 * 1. `[data-load-rule]` rules draw in from the left (scaleX);
 * 2. `[data-load-line]` lines rise through their masks (yPercent), one beat each;
 * 3. `[data-load-item]` items settle under them (opacity, y);
 * 4. `[data-load-row]` index rows stagger in the same way.
 * Beats 1-3 play only if the opening is on the first screen; landing on
 * /#work, the rows come in at once instead of after an opening nobody sees.
 * Rows already above the first screen (/#contact) are left in place. And
 * nothing on the first screen is hidden if the page took longer than
 * motion.load.latest to come alive: it has been seen in place by then.
 * GSAP applies every hidden state here, after hydration: without JS, under
 * reduced motion and in the server HTML the page is already in place.
 */
export function PageLoad({ name, children }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const owns = useRef<boolean | null>(null);
  const { enabled } = useMotionSafe();

  useGSAP(
    () => {
      // Claimed on the first run (the hydration pass), so a visitor who loads
      // with reduced motion never gets a late sequence if they turn it off.
      if (owns.current === null) {
        owns.current = !loadClaimed && !prefersReducedMotion();
        loadClaimed = true;
      }
      const root = scope.current;
      if (!enabled || !owns.current || !root) return;

      const select = gsap.utils.selector(root);
      const rules: Element[] = select('[data-load-rule]');
      const lines: Element[] = select('[data-load-line]');
      const items: Element[] = select('[data-load-item]');
      const rows: Element[] = select('[data-load-row]');

      const sequence = gsap.timeline({
        // Done: a later reduced-motion toggle reverts to the final state and
        // never plays it again.
        onComplete: () => {
          owns.current = false;
        },
      });
      const top = landing();
      // What the visitor has already seen in place is never hidden again.
      const unseen = shownFor() <= motion.load.latest;
      const opening = unseen && [...rules, ...lines].some((element) => onFirstScreen(element, top));
      if (opening) {
        if (rules.length) {
          sequence.from(
            rules,
            {
              scaleX: 0,
              duration: motion.duration.base,
              ease: motion.ease.inOut,
              stagger: motion.stagger.lines,
            },
            0,
          );
        }
        if (lines.length) {
          sequence.from(
            lines,
            {
              yPercent: 100,
              duration: motion.duration.slow,
              ease: motion.ease.inOut,
              stagger: motion.stagger.lines,
            },
            motion.load.lines,
          );
        }
        if (items.length) {
          sequence.from(
            items,
            {
              opacity: 0,
              y: motion.settle,
              duration: motion.duration.fast,
              ease: motion.ease.out,
              stagger: motion.stagger.rows,
            },
            motion.load.content,
          );
        }
      }
      const rowsShown = rows.some((row) => onFirstScreen(row, top));
      const rowsAbove = rows.every((row) => aboveFirstScreen(row, top));
      if (rows.length && !rowsAbove && (unseen || !rowsShown)) {
        sequence.from(
          rows,
          {
            opacity: 0,
            y: motion.settle,
            duration: motion.duration.fast,
            ease: motion.ease.out,
            stagger: motion.stagger.rows,
          },
          opening ? motion.load.rows : 0,
        );
      }
      if (sequence.getChildren().length) recordPlayed(name);
    },
    { scope, dependencies: [enabled], revertOnUpdate: true },
  );

  // `contents`: a scope for GSAP, not a box in the layout.
  return (
    <div ref={scope} className="contents">
      {children}
    </div>
  );
}
