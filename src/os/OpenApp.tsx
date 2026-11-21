'use client';

import type { MouseEvent, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import type { AppId, CaseAppId } from './apps';
import { useOs } from './context';

type Common = {
  className?: string;
  children: ReactNode;
  'aria-label'?: string;
  'aria-describedby'?: string;
};

/** A button that opens (or brings forward) an app's window. Needs JavaScript; pair it with an anchor for documents. */
export function OpenAppButton({ app, ...rest }: Common & { app: AppId }) {
  const { openApp } = useOs();
  return <button type="button" data-open-app={app} {...rest} onClick={(event) => openApp(app, event.currentTarget)} />;
}

/**
 * A project's case page link. Without JavaScript (and for a new tab) it is a
 * plain link; with it, it opens the project window through the shell, which
 * applies the URL rules (a push to open it or to bring an open one forward).
 */
export function OpenAppLink({ app, ...rest }: Common & { app: CaseAppId }) {
  const { openApp } = useOs();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openApp(app, event.currentTarget);
  };
  return <Link href={`/work/${app}/`} data-open-app={app} {...rest} onClick={onClick} />;
}
