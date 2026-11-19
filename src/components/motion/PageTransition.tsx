import { ViewTransition, type ReactNode } from 'react';
import { CASE_OPEN } from '@/design/motion';

// Only navigations tagged CASE_OPEN animate; everything else (back button,
// language switch, refresh) swaps with no transition.
const ON_CASE_OPEN = { [CASE_OPEN]: CASE_OPEN, default: 'none' };

/**
 * Wraps a page's content so a case-open navigation fades it out (leaving) or
 * raises it in (arriving); the CSS lives in globals.css. Rendered by each page
 * view, not a layout: layouts persist across navigations, so they never enter
 * or exit. Without JS or the View Transitions API it is a plain wrapper.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={ON_CASE_OPEN} exit={ON_CASE_OPEN} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
