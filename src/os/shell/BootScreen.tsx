'use client';

/**
 * BootScreen
 *
 * A full-viewport overlay shown on a first visit (html[data-boot="1"] is set
 * by the pre-paint script before the first paint).  Rendered server-side so
 * the lines appear instantly — no flash.  The JS side only drives the timer
 * and skip-on-input behaviour; it never delays the content underneath.
 *
 * Accessibility:
 *  - aria-hidden="true": hidden from screen readers.
 *  - inert: no focus trap; keyboard events on the document still bubble.
 *  - pointer-events:none (CSS): clicks and touches pass through to content and
 *    trigger the document-level pointerdown listener that dismisses the boot.
 */
import { useEffect } from 'react';
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

  useEffect(() => {
    const html = document.documentElement;
    // The boot screen is active only when the pre-paint set data-boot="1".
    if (!html.hasAttribute('data-boot')) return;

    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      html.removeAttribute('data-boot');
      writePref(PREF_KEYS.booted, '1');
    };

    // Skip on any user input.
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', dismiss);

    // Auto-dismiss after the boot animation completes.
    const timer = window.setTimeout(dismiss, BOOT_MS);

    return () => {
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', dismiss);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      data-boot-screen
      aria-hidden="true"
      // inert prevents focus trapping; pointer-events:none (CSS) lets
      // click/touch pass through so the document listener fires.
      inert
    >
      <p className="os-boot-line">{t('line1')}</p>
      <p className="os-boot-line">{t('line2', { count: projectCount })}</p>
      <p className="os-boot-line">{t('line3', { total: totalCommits })}</p>
      <p className="os-boot-line">{t('line4')}</p>
      <p className="os-boot-skip">{t('skip')}</p>
    </div>
  );
}
