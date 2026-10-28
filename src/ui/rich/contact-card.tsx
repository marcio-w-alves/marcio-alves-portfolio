import { useId } from 'react';
import type { RichComponent } from '@/core/chat/components';
import { ButtonLink, Icon, VisuallyHidden } from '../primitives';

type ContactCardProps = Extract<RichComponent, { component: 'contact' }>['props'];

const EMAIL_SUBJECT = 'Engineering opportunity';

// Every action takes a full row once the card is too narrow to fit them side by side.
const ACTION_CLASSES =
  '@max-contact-narrow/contact:h-11.5 @max-contact-narrow/contact:grow @max-contact-narrow/contact:basis-full';

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
      className="@container/contact flex animate-block-enter flex-col gap-4.5 rounded-lg bg-ice p-5.5 shadow-ring"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-ink font-display text-14 leading-none font-semibold tracking-monogram text-white"
        >
          MA
        </span>
        <div>
          <h4
            id={titleId}
            className="font-display text-18 leading-heading font-semibold tracking-heading"
          >
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
          <ButtonLink
            variant="ghost"
            href={resumeUrl}
            target="_blank"
            rel="noopener"
            className={ACTION_CLASSES}
          >
            <Icon name="file" size="sm" />
            View resume
            <VisuallyHidden> (PDF, opens in a new tab)</VisuallyHidden>
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
      <p className="text-12.5 wrap-anywhere text-ink-muted">{email}</p>
    </section>
  );
}
