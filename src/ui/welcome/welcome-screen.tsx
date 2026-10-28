import type { Welcome } from '@/core/knowledge/schema';

interface WelcomeScreenProps {
  readonly welcome: Welcome;
}

/** The greeting. Its title is the page's main heading until a conversation starts. */
export function WelcomeScreen({ welcome }: WelcomeScreenProps) {
  return (
    <header className="flex flex-col items-center gap-3.5 text-center">
      <h1 className="m-0 font-display text-hero leading-hero font-medium tracking-hero">
        {welcome.heading}
      </h1>
      <p className="m-0 max-w-hero-text text-16.5 leading-prose text-balance text-ink-muted @max-phone/ma:text-15.5">
        {welcome.description}
      </p>
    </header>
  );
}
