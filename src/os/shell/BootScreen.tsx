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
 */
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { PREF_KEYS, writePref } from '@/os/storage';

/** Total boot duration in ms.  Lines animate over this window. */
const BOOT_MS = 1100;

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
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    dismiss();
  };

  return (
    <div
      data-boot-screen
      aria-hidden="true"
      onClick={handleClick}
    >
      <p className="os-boot-line">{t('line1')}</p>
      <p className="os-boot-line">{t('line2', { count: projectCount })}</p>
      <p className="os-boot-line">{t('line3', { total: totalCommits })}</p>
      <p className="os-boot-line">{t('line4')}</p>
      <p className="os-boot-skip">{t('skip')}</p>
    </div>
  );
}
