import { useId } from 'react';
import type { RichComponent } from '@/core/assistant/components';
import { ButtonLink, Icon, VisuallyHidden } from '../primitives';

type ContactCardProps = Extract<RichComponent, { component: 'contact' }>['props'];

const EMAIL_SUBJECT = 'Engineering opportunity';

// Every action takes a full row once the card is too narrow to fit them side by side.
const ACTION_CLASSES =
  '@max-contact-narrow/contact:h-11 @max-contact-narrow/contact:grow @max-contact-narrow/contact:basis-full';

export function ContactCard({
  heading,
  text,
  email,
  linkedin,
  github,
  resumeUrl,
}: ContactCardProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="shadow-raised @container/contact flex animate-block-enter flex-col gap-4 rounded-lg bg-surface px-5.5 py-5"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-mark-lg bg-accent text-14 leading-none font-semibold tracking-monogram text-white"
        >
          MA
        </span>
        <div>
          <h4 id={titleId} className="text-18 leading-heading font-semibold tracking-subhead">
            {heading}
          </h4>
          <p className="mt-1 text-14.5 leading-reading text-ink-muted">{text}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <ButtonLink
          variant="primary"
          href={`mailto:${email}?subject=${encodeURIComponent(EMAIL_SUBJECT)}`}
          className={ACTION_CLASSES}
        >
          <Icon name="mail" size="sm" />
          Contact Marcio
        </ButtonLink>
        <ButtonLink
          href={linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className={ACTION_CLASSES}
        >
          <Icon name="link" size="sm" />
          View LinkedIn
          <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
        </ButtonLink>
        {resumeUrl ? (
          <ButtonLink variant="ghost" href={resumeUrl} download className={ACTION_CLASSES}>
            <Icon name="download" size="sm" />
            Download resume
          </ButtonLink>
        ) : null}
        {github ? (
          <ButtonLink
            variant="ghost"
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className={ACTION_CLASSES}
          >
            <Icon name="code" size="sm" />
            GitHub
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </ButtonLink>
        ) : null}
      </div>
      <p className="font-mono text-12 leading-normal wrap-anywhere text-ink-muted">{email}</p>
    </section>
  );
}
