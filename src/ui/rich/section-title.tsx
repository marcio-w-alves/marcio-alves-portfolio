import type { ReactNode } from 'react';

export function SectionTitle({ children }: { readonly children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-11 leading-label font-medium tracking-label text-ink-muted uppercase">
      {children}
    </p>
  );
}
