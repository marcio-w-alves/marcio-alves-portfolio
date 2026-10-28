import type { ReactNode } from 'react';

export function SectionTitle({ children }: { readonly children: ReactNode }) {
  return <p className="mb-2 text-12 leading-label font-semibold text-ink">{children}</p>;
}
