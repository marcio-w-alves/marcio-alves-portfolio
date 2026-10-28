import type { ReactNode } from 'react';

/**
 * The welcome column. Holds, in order: the greeting, the phone topic chips,
 * the composer and the suggested questions.
 */
export function WelcomeLayout({ children }: { readonly children: ReactNode }) {
  return (
    <section
      aria-label="Welcome"
      className="flex min-h-full animate-fade-slow flex-col justify-center pt-14 pb-16 @max-phone/ma:justify-start @max-phone/ma:pt-7 @max-phone/ma:pb-8"
    >
      <div className="mx-auto flex w-full max-w-welcome flex-col gap-8 px-8 @max-phone/ma:px-4">
        {children}
      </div>
    </section>
  );
}
