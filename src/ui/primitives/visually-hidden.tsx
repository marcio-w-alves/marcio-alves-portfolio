import type { ReactNode } from 'react';

/** Read by assistive technology, invisible on screen. */
export function VisuallyHidden({ children }: { readonly children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
