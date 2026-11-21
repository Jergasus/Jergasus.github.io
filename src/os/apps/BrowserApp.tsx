'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { projects } from '@/content/projects';
import { useOs } from '../context';

/** Projects that have a live URL — shown on the start page. */
const liveProjects = projects.filter((p) => p.liveUrl !== null);

/** How many milliseconds to wait for the iframe's load event before giving up. */
const LOAD_TIMEOUT_MS = 8_000;

/**
 * Retro browser app.
 *
 * - Shows a start page (live project buttons) when no URL is set.
 * - Shows a read-only address bar, reload and "Abrir en una pestaña nueva" when a URL is set.
 * - Creates the iframe only when the browser window is open and a URL is loaded.
 * - Shows a loading overlay until the iframe fires its load event.
 * - If the load event does not fire within 8 s, shows the fallback message with a
 *   prominent "Abrir en una pestaña nueva" link.
 */
export function BrowserApp() {
  const { state, browserUrl, openBrowser } = useOs();
  const t = useTranslations('os.browser');

  const isWindowOpen = state.windows.browser.open;
  const showIframe = isWindowOpen && browserUrl !== null;

  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start/reset the loading state whenever the visible URL changes.
  // useLayoutEffect (not useEffect) so the timer is registered synchronously
  // after the DOM update but before the browser paints — this lets Playwright's
  // page.clock.fastForward reliably trigger the timeout in e2e tests.
  useLayoutEffect(() => {
    window.clearTimeout(timerRef.current);
    if (showIframe) {
      setLoading(true);
      setFailed(false);
      timerRef.current = setTimeout(() => {
        setFailed(true);
        setLoading(false);
      }, LOAD_TIMEOUT_MS);
    } else {
      setLoading(false);
      setFailed(false);
    }
    return () => window.clearTimeout(timerRef.current);
  }, [showIframe, browserUrl]);

  const handleLoad = useCallback(() => {
    // R10 limitation: a cross-origin iframe's onLoad fires for BOTH a real page
    // and the browser's own error/blocked page, because both produce a
    // SecurityError when you try to read contentWindow.location.  We cannot
    // distinguish the two cases here.
    //
    // Design consequence:
    //   • The URL allowlist (isAllowedBrowserUrl) restricts iframes to known
    //     project sites, so arbitrary URLs can never be loaded.
    //   • The "Abrir en una pestaña nueva" link is always visible in the toolbar
    //     so users can reach a blocked/offline site directly.
    //   • The 8-second timer provides the fallback for stalled or offline loads.
    //
    // When a real cross-origin page loads, contentWindow.location throws
    // SecurityError → catch block clears the timer (success path).
    // When the browser shows an error page (also cross-origin), the same
    // SecurityError fires → timer is cleared too, but Chrome's error UI is
    // already visible inside the iframe.
    try {
      // If we can read the href the frame is same-origin (e.g. about:blank),
      // which means the navigation has not yet reached a real page.
      const href = iframeRef.current?.contentWindow?.location?.href ?? '';
      if (href === 'about:blank' || href === '') return;
    } catch {
      // SecurityError = cross-origin page loaded (real site or error page).
    }
    window.clearTimeout(timerRef.current);
    setLoading(false);
    setFailed(false);
  }, []);

  const handleReload = useCallback(() => {
    if (!iframeRef.current || !browserUrl) return;
    window.clearTimeout(timerRef.current);
    setLoading(true);
    setFailed(false);
    // Reset the src so the iframe refetches.
    iframeRef.current.src = browserUrl;
    timerRef.current = setTimeout(() => {
      setFailed(true);
      setLoading(false);
    }, LOAD_TIMEOUT_MS);
  }, [browserUrl]);

  return (
    <div className="os-browser">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="os-browser-toolbar" role="toolbar" aria-label={t('toolbarLabel')}>
        {/* Read-only: the label is text for assistive technology, since a
            plain span cannot carry aria-label. */}
        <span data-browser-address className="os-browser-address">
          <span className="sr-only">{t('addressLabel')}: </span>
          {browserUrl ?? ''}
        </span>

        {browserUrl && (
          <button
            type="button"
            className="os-browser-reload"
            onClick={handleReload}
            aria-label={t('reload')}
          >
            {/* Simple reload glyph */}
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path
                d="M6 2a4 4 0 1 0 3.46 2H8.26A2.75 2.75 0 1 1 6 3.25V5l3-2.5L6 0z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}

        {/* "Abrir en una pestaña nueva" — always visible when a URL is loaded. */}
        {browserUrl && (
          <a
            href={browserUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="os-browser-new-tab"
          >
            {t('openInNewTab')}
          </a>
        )}
      </div>

      {/* ── Viewport ─────────────────────────────────────────────────────── */}
      <div className="os-browser-viewport">
        {showIframe ? (
          <>
            {/* Loading overlay */}
            {loading && !failed && (
              <div className="os-browser-overlay" aria-live="polite">
                <p>{t('loading')}</p>
              </div>
            )}

            {/* Failure overlay — shown when the site did not load within 8 s. */}
            {failed && (
              <div
                data-browser-failed
                className="os-browser-overlay os-browser-overlay--failed"
                aria-live="polite"
              >
                <p>{t('failed')}</p>
                {/* Prominent new-tab link in the failure state. */}
                <a
                  href={browserUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="os-button"
                >
                  {t('openInNewTab')}
                </a>
              </div>
            )}

            {/* The iframe. Created only while the window is open with a URL.
                Removed automatically when showIframe becomes false (close / no URL). */}
            <iframe
              ref={iframeRef}
              src={browserUrl}
              title={t('iframeTitle', { url: browserUrl })}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="eager"
              className="os-browser-iframe"
              style={{ visibility: loading || failed ? 'hidden' : 'visible' }}
              onLoad={handleLoad}
            />
          </>
        ) : (
          /* Start page — shown when the browser is open but no URL is loaded. */
          <div className="os-browser-start">
            <p className="os-browser-start-prompt">{t('startPrompt')}</p>
            <ul className="os-browser-start-list">
              {liveProjects.map((p) => (
                <li key={p.slug}>
                  <button
                    type="button"
                    className="os-button"
                    onClick={() => openBrowser(p.liveUrl!)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
