'use client';

/**
 * BootScreen
 *
 * A full-viewport overlay shown on a first visit (html[data-boot="1"] is set
 * by the pre-paint script before the first paint).  Rendered server-side so
 * the lines appear instantly — no flash.  The JS side only drives the timer
 * and skip-on-input behaviour.
 *
 * Click / tap capture strategy:
 *  - The overlay has NO pointer-events:none and NO inert, so it sits at
 *    z-index 9999 and intercepts all pointer events.
 *  - Dismiss is triggered by onClick (not pointerdown) on the boot screen div.
 *    At that moment the overlay is still visible (data-boot not yet removed),
 *    so the browser hit-tested the boot screen, NOT whatever is underneath.
 *    stopPropagation() + preventDefault() ensure React does not fire any
 *    handlers further up the tree, then we dismiss.
 *  - Keyboard dismiss is handled on the document so any key works.
 *  - aria-hidden="true" keeps it out of the accessibility tree.  There are no
 *    focusable children so a focus trap is not possible.
 *
 * Motion: the lines appear one by one, a step (motion.os.bootLine) apart, like
 * an old machine printing its start-up checks. It is CSS (os.css), so it runs
 * from the first paint, before and during hydration; the step reaches it as
 * --os-boot-step and each line's index as --i. Reduced motion never boots.
 */
import { useEffect, useRef, type CSSProperties, type MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from '@/design/motion';
import { PREF_KEYS, writePref } from '@/os/storage';

/** Four loading lines and the skip hint, one step each. */
const BEATS = 5;
/** The boot ends one step after the last line appears (about 1 s). */
const BOOT_MS = Math.round(BEATS * motion.os.bootLine * 1000);

const step = (i: number) => ({ '--i': i }) as CSSProperties;

export type BootScreenProps = {
  /** Number of projects shown in the loading line. */
  projectCount: number;
  /** Total commits shown in the loading line. */
  totalCommits: number;
};

export function BootScreen({ projectCount, totalCommits }: BootScreenProps) {
  const t = useTranslations('os.boot');
  const dismissedRef = useRef(false);

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    document.documentElement.removeAttribute('data-boot');
    writePref(PREF_KEYS.booted, '1');
  };

  useEffect(() => {
    const html = document.documentElement;
    // The boot screen is active only when the pre-paint set data-boot="1".
    if (!html.hasAttribute('data-boot')) return;

    // Skip on any key anywhere in the document.
    document.addEventListener('keydown', dismiss);

    // Auto-dismiss after the boot animation completes.
    const timer = window.setTimeout(dismiss, BOOT_MS);

    return () => {
      document.removeEventListener('keydown', dismiss);
      window.clearTimeout(timer);
    };
    // dismiss is stable (closure over refs) — no deps needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click handler: the click fires while the boot screen is still visible
  // (data-boot not yet removed), so the browser hit-tested THIS element,
  // not whatever is underneath.  stopPropagation absorbs it; then we dismiss.
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    dismiss();
  };

  return (
    <div
      data-boot-screen
      aria-hidden="true"
      onClick={handleClick}
      style={{ '--os-boot-step': `${motion.os.bootLine}s` } as CSSProperties}
    >
      <p className="os-boot-line" style={step(0)}>{t('line1')}</p>
      <p className="os-boot-line" style={step(1)}>{t('line2', { count: projectCount })}</p>
      <p className="os-boot-line" style={step(2)}>{t('line3', { total: totalCommits })}</p>
      <p className="os-boot-line" style={step(3)}>{t('line4')}</p>
      <p className="os-boot-skip" style={step(4)}>{t('skip')}</p>
    </div>
  );
}
