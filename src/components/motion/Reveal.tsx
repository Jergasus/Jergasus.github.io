'use client';

import { useRef, type ReactNode } from 'react';
import { motion } from '@/design/motion';
import { gsap, SplitText, useGSAP } from './gsap';
import { useMotionSafe } from './useMotionSafe';

type Props = { children: ReactNode; className?: string };

// Both tweens of a block share the trigger, but each gets its own copy.
const triggerFor = (root: Element) => ({
  trigger: root,
  start: `top ${motion.reveal.at * 100}%`,
  once: true,
});

/**
 * Scroll reveal for one block of a page, played once when the block's top
 * passes motion.reveal.at of the viewport:
 * - `[data-reveal-heading]` headings rise line by line through masks
 *   (SplitText, re-split if fonts or the width change before it plays);
 * - `[data-reveal-item]` items settle (opacity, y), after the heading.
 * Renders a plain <div> carrying `className`, so it can stand in for a
 * section's existing wrapper. A block already past the line when it is set up
 * is left as it is: on a full load it is part of the first screen, and after
 * a client navigation the view transition has already moved it in. GSAP sets
 * every hidden state here; without JS or under reduced motion nothing hides.
 */
export function Reveal({ children, className }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const { enabled } = useMotionSafe();

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current;
      if (!enabled || !root || !contextSafe) return;

      // Measure a frame later: after a client navigation Next.js resets the
      // scroll position after this effect runs.
      const frame = requestAnimationFrame(
        contextSafe(() => {
          if (root.getBoundingClientRect().top < window.innerHeight * motion.reveal.at) return;

          for (const heading of root.querySelectorAll<HTMLElement>('[data-reveal-heading]')) {
            SplitText.create(heading, {
              type: 'lines',
              mask: 'lines',
              // Styled in globals.css: the masks bleed above each line so
              // accents on display capitals are never clipped.
              linesClass: 'reveal-line',
              autoSplit: true,
              onSplit: (split) =>
                gsap.from(split.lines, {
                  yPercent: 100,
                  duration: motion.duration.base,
                  // The visitor's own scroll set this off, so it answers at
                  // once (expo.out); the in-out shutter belongs to the
                  // choreographed page load.
                  ease: motion.ease.out,
                  stagger: motion.stagger.lines,
                  scrollTrigger: triggerFor(root),
                  // Landed: restore the heading's own markup. revert() also
                  // stops autoSplit (kill(): its ResizeObserver, debounce and
                  // font listener), so a resize or late font load never
                  // re-splits a landed heading and replays it (e2e-guarded).
                  onComplete: () => {
                    split.revert();
                  },
                }),
            });
          }

          const items = root.querySelectorAll('[data-reveal-item]');
          if (items.length) {
            gsap.from(items, {
              opacity: 0,
              y: motion.settle,
              duration: motion.duration.fast,
              ease: motion.ease.out,
              stagger: motion.stagger.rows,
              delay: motion.reveal.items,
              scrollTrigger: triggerFor(root),
            });
          }
        }),
      );
      return () => cancelAnimationFrame(frame);
    },
    { scope, dependencies: [enabled], revertOnUpdate: true },
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
