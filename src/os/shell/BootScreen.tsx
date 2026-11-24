'use client';

/**
 * BootScreen
 *
 * A full-viewport overlay shown on every full page load (html[data-boot="1"]
 * is set by the pre-paint IIFE before the first paint). Rendered server-side
 * so the lines appear instantly — no flash.
 *
 * Lifecycle (pre-paint script owns it):
 *  - The IIFE sets data-boot="1", registers keydown and click capture
 *    listeners on document, and schedules window.setTimeout(end, BOOT_MS).
 *  - Any key or click calls end() at once — before or after hydration.
 *  - end() removes data-boot, the listeners, and the timer.
 *  - CSS hides the overlay when data-boot is absent.
 *  - React has no boot logic here; this component is markup only.
 *
 * Animation: the skip hint is at step 0 (visible from the first paint), and
 * the four lines appear at steps 1–4, one bootLine second apart.
 * CSS drives the animation (--os-boot-step, --i), so it runs from the first
 * paint before hydration. Reduced motion never boots.
 *
 * Accessibility: aria-hidden="true" keeps it out of the accessibility tree.
 * There are no focusable children, so a focus trap is not possible.
 * The boot never traps keyboard input after it ends.
 */
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from '@/design/motion';
import { JgOsLogo } from '@/os/icons/JgOsLogo';

const step = (i: number) => ({ '--i': i }) as CSSProperties;

export type BootScreenProps = {
  /** Number of projects shown in the loading line. */
  projectCount: number;
  /** Total commits shown in the loading line. */
  totalCommits: number;
};

export function BootScreen({ projectCount, totalCommits }: BootScreenProps) {
  const t = useTranslations('os.boot');

  return (
    <div
      data-boot-screen
      aria-hidden="true"
      style={{ '--os-boot-step': `${motion.os.bootLine}s` } as CSSProperties}
    >
      <div className="os-boot-brand">
        <JgOsLogo size={104} />
        <p className="os-boot-name">JG-OS</p>
      </div>
      <p className="os-boot-line" style={step(1)}>{t('line1')}</p>
      <p className="os-boot-line" style={step(2)}>{t('line2', { count: projectCount })}</p>
      <p className="os-boot-line" style={step(3)}>{t('line3', { total: totalCommits })}</p>
      <p className="os-boot-line" style={step(4)}>{t('line4')}</p>
      {/* Two hints: CSS shows the right one for the input device. */}
      <p className="os-boot-skip os-boot-skip--key" data-boot-hint="key" style={step(0)}>{t('skip')}</p>
      <p className="os-boot-skip os-boot-skip--touch" data-boot-hint="touch" style={step(0)}>{t('skipTouch')}</p>
    </div>
  );
}
