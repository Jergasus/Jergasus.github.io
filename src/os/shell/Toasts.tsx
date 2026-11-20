'use client';

/**
 * Toasts
 *
 * Shows OS-style commit notifications once per session.  Timing:
 *  - If the boot screen ran: starts after data-boot is removed, with a small
 *    extra delay so the transition feels natural.
 *  - If there was no boot (returning visitor): starts 1200 ms after hydration.
 *
 * Freshness is evaluated client-side (commitNotifications calls new Date()),
 * which keeps the behaviour deterministic in e2e tests via page.clock.
 *
 * Privacy: only { slug, lastCommitAt } pairs cross to the client.  No branch
 * names, commit messages, totalCommits per repo or weekly arrays are present.
 *
 * Accessibility:
 *  - [data-toasts] is an aria-live="polite" region, always in the DOM so AT
 *    can observe changes.
 *  - Each close button has an accessible name from os.notifications.dismiss.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectSlug } from '@/content/projects';
import { getProject } from '@/content/projects';
import type { Locale } from '@/i18n/routing';
import { formatRelative } from '@/lib/dates';
import { commitNotifications } from '@/os/notifications';
import { SESSION_KEY_TOASTS, readSession, writeSession } from '@/os/storage';

/** Delay before showing toasts when no boot ran (ms). */
const NO_BOOT_DELAY_MS = 1200;
/** Delay after the boot screen clears before showing the first toast (ms). */
const POST_BOOT_DELAY_MS = 100;
/** Time between the first and subsequent toasts (ms). */
const STAGGER_MS = 2000;
/** Auto-dismiss delay per toast (ms). */
const AUTO_DISMISS_MS = 7000;

export type NotifRepo = { slug: ProjectSlug; lastCommitAt: string };

type VisibleToast = { id: number; slug: ProjectSlug; lastCommitAt: string };

type Props = {
  /** Raw activity repos — only slug and lastCommitAt, never private fields. */
  repos: NotifRepo[];
  locale: Locale;
};

export function Toasts({ repos, locale }: Props) {
  const t = useTranslations('os.notifications');
  const [visibleToasts, setVisibleToasts] = useState<VisibleToast[]>([]);
  const shownRef = useRef(false);
  const idRef = useRef(0);

  useEffect(() => {
    // Evaluate freshness client-side so page.clock controls the result.
    const freshNotifs = commitNotifications(repos, new Date(), {
      max: 2,
      maxAgeDays: 14,
    });
    if (freshNotifs.length === 0) return;

    // Once per session.
    if (readSession<string>(SESSION_KEY_TOASTS) === '1') return;
    if (shownRef.current) return;

    const html = document.documentElement;
    const timers: number[] = [];
    let observer: MutationObserver | null = null;
    let extraTimer: number | null = null;

    const startToasts = () => {
      writeSession(SESSION_KEY_TOASTS, '1');
      shownRef.current = true;

      freshNotifs.forEach((notif, i) => {
        const t1 = window.setTimeout(() => {
          const id = ++idRef.current;
          setVisibleToasts((prev) => [...prev, { id, ...notif }]);

          const t2 = window.setTimeout(() => {
            setVisibleToasts((prev) => prev.filter((tk) => tk.id !== id));
          }, AUTO_DISMISS_MS);
          timers.push(t2);
        }, i * STAGGER_MS);
        timers.push(t1);
      });
    };

    if (!html.hasAttribute('data-boot')) {
      // No boot: show after a fixed delay.
      const timer = window.setTimeout(startToasts, NO_BOOT_DELAY_MS);
      timers.push(timer);
    } else {
      // Boot active: watch for data-boot removal, then start.
      observer = new MutationObserver(() => {
        if (!html.hasAttribute('data-boot') && observer) {
          observer.disconnect();
          observer = null;
          extraTimer = window.setTimeout(startToasts, POST_BOOT_DELAY_MS);
        }
      });
      observer.observe(html, { attributes: true, attributeFilter: ['data-boot'] });
    }

    return () => {
      observer?.disconnect();
      if (extraTimer !== null) window.clearTimeout(extraTimer);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [repos]);

  const dismiss = (id: number) => {
    setVisibleToasts((prev) => prev.filter((tk) => tk.id !== id));
  };

  return (
    // The region is always in the DOM so AT can observe live changes.
    <div data-toasts role="region" aria-live="polite" aria-label={t('region')} className="os-toasts-region">
      {visibleToasts.map((toast) => {
        const project = getProject(toast.slug);
        const name = project?.name ?? (toast.slug as string);
        const when = formatRelative(toast.lastCommitAt, new Date(), locale);
        return (
          <div key={toast.id} data-toast className="os-toast">
            <span className="os-toast-text">{t('commit', { project: name, when })}</span>
            <button
              type="button"
              className="os-toast-close"
              aria-label={t('dismiss')}
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
