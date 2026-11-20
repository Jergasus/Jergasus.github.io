'use client';

import { useEffect, type ReactNode } from 'react';
import type { CaseAppId } from './apps';
import { useOsInternal } from './context';

type Props = { slug: CaseAppId; children: ReactNode };

/**
 * Wraps the routed project's window on a case page. It renders the window in
 * place (so the server HTML has the full case study) and, while the window is
 * open, hands a copy to the shell, which keeps it open when the URL moves to
 * another project.
 */
export function CaseKeeper({ slug, children }: Props) {
  const { state, registerCase } = useOsInternal();
  const open = state.windows[slug].open;
  useEffect(() => {
    if (open) registerCase(slug, children);
  }, [open, registerCase, slug, children]);
  return children;
}
