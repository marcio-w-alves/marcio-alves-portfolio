import { EvidenceLine, type Evidence } from './evidence-line';
import { WelcomeContact, type WelcomeContactLinks } from './welcome-contact';

/** How the home page greets a visitor, as the server worded it. */
export interface WelcomeGreeting {
  readonly heading: string;
  readonly description: string;
  readonly evidence: Evidence;
}

interface WelcomeScreenProps {
  readonly welcome: WelcomeGreeting;
  readonly links: WelcomeContactLinks;
}

/** The greeting. Its title is the page's main heading until a conversation starts. */
export function WelcomeScreen({ welcome, links }: WelcomeScreenProps) {
  return (
    <header className="flex flex-col items-center gap-3.5 text-center">
      <h1 className="m-0 font-display text-hero leading-hero font-medium tracking-hero">
        {welcome.heading}
      </h1>
      <p className="m-0 max-w-hero-text text-16.5 leading-prose text-balance text-ink-muted @max-phone/ma:text-15.5">
        {welcome.description}
      </p>
      <EvidenceLine evidence={welcome.evidence} />
      <WelcomeContact links={links} />
    </header>
  );
}
