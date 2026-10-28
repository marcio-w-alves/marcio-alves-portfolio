import { useMessages } from '../i18n/i18n-provider';
import { ButtonLink, Icon, VisuallyHidden } from '../primitives';

/** Where a visitor reaches the person, and their résumé while one is published. */
export interface WelcomeContactLinks {
  readonly email: string;
  readonly linkedin: string;
  readonly resumeUrl: string | null;
}

/**
 * Contact and the résumé, offered on the welcome screen wherever the sidebar
 * that also holds them is folded into the drawer.
 */
export function WelcomeContact({ links }: { readonly links: WelcomeContactLinks }) {
  const messages = useMessages();
  const { shell } = messages;
  return (
    <ul
      aria-label={messages.welcome.contact}
      className="m-0 hidden list-none flex-wrap justify-center gap-2 p-0 @max-compact/ma:flex"
    >
      <li>
        <ButtonLink
          size="sm"
          href={`mailto:${links.email}?subject=${encodeURIComponent(messages.emailSubject)}`}
          className="h-11"
        >
          <Icon name="mail" size="sm" />
          {shell.getInTouch}
        </ButtonLink>
      </li>
      <li>
        <ButtonLink
          size="sm"
          href={links.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11"
        >
          <Icon name="link" size="sm" />
          {shell.linkedin}
          <VisuallyHidden> {messages.links.opensInNewTab}</VisuallyHidden>
        </ButtonLink>
      </li>
      {links.resumeUrl ? (
        <li>
          <ButtonLink
            size="sm"
            href={links.resumeUrl}
            target="_blank"
            rel="noopener"
            className="h-11"
          >
            <Icon name="file" size="sm" />
            {shell.resume}
            <VisuallyHidden> {messages.links.pdfOpensInNewTab}</VisuallyHidden>
          </ButtonLink>
        </li>
      ) : null}
    </ul>
  );
}
