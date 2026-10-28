import type { ReactNode } from 'react';
import { useMessages } from '../i18n/i18n-provider';

/** The welcome column. Holds, in order: the greeting, the composer and the suggested questions. */
export function WelcomeLayout({ children }: { readonly children: ReactNode }) {
  const { welcome } = useMessages();
  return (
    <section
      aria-label={welcome.region}
      className="flex min-h-full animate-fade-slow flex-col justify-center pt-14 pb-welcome-end @max-phone/ma:pt-12 @max-phone/ma:pb-8"
    >
      <div className="mx-auto flex w-full max-w-welcome flex-col gap-9 px-8 @max-phone/ma:gap-7 @max-phone/ma:px-5">
        {children}
      </div>
    </section>
  );
}
