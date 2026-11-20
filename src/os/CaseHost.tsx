'use client';

import { Fragment, useEffect } from 'react';
import { apps, type CaseAppId } from './apps';
import { CaseRoutedContext, useOsInternal } from './context';

const CASE_APPS = apps.filter((app) => app.route === 'case').map((app) => app.id as CaseAppId);

/**
 * Keeps project windows alive across navigations. The page renders the
 * routed project's window (CaseKeeper registers it here as it mounts); this
 * renders every other project window that is still open, from that cache.
 * Both read the routed slug from the same render, so a window is never
 * rendered twice. A window that closes leaves the cache; after a reload the
 * cache is empty, so only the routed window is open.
 */
export function CaseHost() {
  const { state, routedSlug, cases, dropCase } = useOsInternal();

  useEffect(() => {
    for (const slug of CASE_APPS) {
      if (cases[slug] && !state.windows[slug].open) dropCase(slug);
    }
  }, [cases, state.windows, dropCase]);

  return (
    <CaseRoutedContext value={false}>
      {CASE_APPS.map((slug) =>
        slug !== routedSlug && state.windows[slug].open && cases[slug] ? (
          <Fragment key={slug}>{cases[slug]}</Fragment>
        ) : null,
      )}
    </CaseRoutedContext>
  );
}
