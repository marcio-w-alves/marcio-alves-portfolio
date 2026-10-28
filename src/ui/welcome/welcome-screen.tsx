import type { Welcome } from '@/core/knowledge/types';
import { Eyebrow } from '../primitives';

interface WelcomeScreenProps {
  readonly welcome: Welcome;
}

/** The greeting. Its title is the page's main heading until a conversation starts. */
export function WelcomeScreen({ welcome }: WelcomeScreenProps) {
  return (
    <header className="flex flex-col gap-3.5">
      <Eyebrow>{welcome.eyebrow}</Eyebrow>
      <h1 className="mt-1.5 text-display leading-display font-semibold tracking-display">
        {welcome.heading}
      </h1>
      <p className="m-0 text-subhead leading-subhead tracking-subhead text-ink-muted">
        {welcome.subheading}
      </p>
      <div className="mt-2.5 flex max-w-measure flex-col gap-2.5">
        <p className="m-0 text-16.5 leading-prose text-pretty @max-phone/ma:text-15.5">
          {welcome.description}
        </p>
        <p className="m-0 text-16.5 leading-prose text-pretty text-ink-muted @max-phone/ma:text-15.5">
          {welcome.invitation}
        </p>
      </div>
    </header>
  );
}
