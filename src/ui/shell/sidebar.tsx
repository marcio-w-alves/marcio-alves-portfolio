import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TopicId } from '@/core/chat/topic-id';
import { cn } from '../cn';
import { useMessages } from '../i18n/i18n-provider';
import { Icon, IconButton, VisuallyHidden, type IconName } from '../primitives';
import { ThemeSwitcher } from '../theme/theme-switcher';

export interface SidebarProfile {
  readonly name: string;
  readonly title: string;
  readonly photoUrl: string | null;
}

export interface SidebarTopic {
  readonly id: TopicId;
  readonly label: string;
  readonly icon: IconName;
  /** The topic's own page. */
  readonly href: string;
}

export interface SidebarLinks {
  readonly email: string;
  readonly linkedin: string;
  readonly github: string;
  readonly resumeUrl: string | null;
}

interface SidebarProps {
  readonly profile: SidebarProfile;
  readonly topics: readonly SidebarTopic[];
  readonly activeTopic: TopicId;
  readonly links: SidebarLinks;
  readonly onNewConversation: () => void;
  /** Only shown in the drawer layout. */
  readonly onClose: () => void;
}

const FOOT_LINK =
  'inline-flex h-7 items-center gap-1.5 text-12.5 text-ink-muted no-underline @max-compact/ma:h-10 @max-compact/ma:text-14';

export function Sidebar({
  profile,
  topics,
  activeTopic,
  links,
  onNewConversation,
  onClose,
}: SidebarProps) {
  const { shell } = useMessages();
  return (
    <aside
      aria-label={shell.navigation}
      className="flex h-full flex-col gap-7 overflow-y-auto px-3 pt-5.5 pb-4.5"
    >
      <div className="flex items-start gap-2 pr-1 pl-2.5">
        {profile.photoUrl ? (
          // The name beside it says who this is, so the picture itself is decorative.
          // A plain img: the photo is a few kilobytes already, and next/image would
          // add its client code to every page's budget.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoUrl}
            alt=""
            width={40}
            height={40}
            decoding="async"
            className="mt-0.5 size-10 shrink-0 rounded-full object-cover shadow-ring"
          />
        ) : null}
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-display text-15 leading-heading font-semibold tracking-identity">
            {profile.name}
          </p>
          <p className="mt-0.75 text-12.5 leading-label text-ink-muted">{profile.title}</p>
        </div>
        <IconButton
          icon="compose"
          iconSize="sm"
          label={shell.newConversation}
          title={shell.newConversation}
          onClick={onNewConversation}
          className="@max-compact/ma:hidden"
        />
        <IconButton
          icon="close"
          label={shell.closeNavigation}
          size="touch"
          onClick={onClose}
          className="hidden @max-compact/ma:inline-grid"
        />
      </div>

      <nav aria-label={shell.topics}>
        <ul className="flex flex-col gap-0.5">
          {topics.map((topic) => (
            <li key={topic.id}>
              <TopicLink topic={topic} active={topic.id === activeTopic} onNavigate={onClose} />
            </li>
          ))}
        </ul>
      </nav>

      <SidebarFooter links={links} />
    </aside>
  );
}

function TopicLink({
  topic,
  active,
  onNavigate,
}: {
  topic: SidebarTopic;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={topic.href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        'group flex h-9 w-full cursor-pointer items-center gap-2.75 rounded-sm bg-transparent px-2.5 text-left font-sans text-13.5 leading-none font-book text-ink-muted no-underline',
        'transition-[background-color,color,box-shadow,scale] duration-fast ease-standard active:scale-99',
        '@max-compact/ma:h-11.5 @max-compact/ma:text-15',
        active
          ? 'bg-surface font-medium text-ink shadow-ring'
          : 'hover:bg-fill-hover hover:text-ink',
      )}
    >
      <Icon
        name={topic.icon}
        className={cn(
          'size-4.25 transition-colors duration-fast ease-standard',
          active ? 'text-ink' : 'text-ink-faint group-hover:text-ink-muted',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{topic.label}</span>
    </Link>
  );
}

function SidebarFooter({ links }: { links: SidebarLinks }) {
  const messages = useMessages();
  const { shell } = messages;
  const mailto = `mailto:${links.email}?subject=${encodeURIComponent(messages.emailSubject)}`;
  return (
    <div className="mt-auto flex flex-col gap-1 px-2.5">
      <div className="mb-5">
        <ThemeSwitcher />
      </div>
      <a
        href={mailto}
        className="group -mt-3 inline-flex min-h-11 w-fit items-center gap-1.5 py-3 text-13.5 leading-label font-medium text-ink no-underline"
      >
        {shell.getInTouch}
        <Icon
          name="arrowUpRight"
          size="sm"
          className="transition-[translate] duration-medium ease-standard group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </a>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-3 inset-shadow-rule-top">
        <li>
          <ExternalLink href={links.linkedin}>{shell.linkedin}</ExternalLink>
        </li>
        <li>
          <ExternalLink href={links.github}>{shell.github}</ExternalLink>
        </li>
        <li>
          {links.resumeUrl ? (
            <a
              href={links.resumeUrl}
              target="_blank"
              rel="noopener"
              className={cn(
                FOOT_LINK,
                'transition-colors duration-fast ease-standard hover:text-ink',
              )}
            >
              {shell.resume}
              <VisuallyHidden> {messages.links.pdfOpensInNewTab}</VisuallyHidden>
            </a>
          ) : (
            <span className={cn(FOOT_LINK, 'cursor-default')}>
              {shell.resume}
              <span className="rounded-pill bg-fill px-1.5 py-0.5 text-11 text-ink-muted">
                {shell.resumeSoon}
              </span>
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const { links } = useMessages();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(FOOT_LINK, 'transition-colors duration-fast ease-standard hover:text-ink')}
    >
      {children}
      <VisuallyHidden> {links.opensInNewTab}</VisuallyHidden>
    </a>
  );
}
