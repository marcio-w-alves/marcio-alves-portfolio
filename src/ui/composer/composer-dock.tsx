import type { ReactNode } from 'react';

interface ComposerDockProps {
  /** The composer, held to the conversation's column. */
  readonly children: ReactNode;
  /** A `JumpToLatest`, floated above the dock while the visitor is scrolled away. */
  readonly jumpToLatest?: ReactNode;
}

/** The strip under the conversation that keeps the composer in reach. */
export function ComposerDock({ children, jumpToLatest }: ComposerDockProps) {
  return (
    <div className="relative shrink-0 bg-bg pt-1 pb-3.5">
      {jumpToLatest}
      <div className="mx-auto max-w-column px-8 @max-phone/ma:px-4">{children}</div>
    </div>
  );
}
