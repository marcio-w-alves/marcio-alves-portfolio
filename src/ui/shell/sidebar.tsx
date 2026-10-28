import type { ReactNode } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import { cn } from '../cn';
import { Icon, IconButton, VisuallyHidden, type IconName } from '../primitives';

export interface SidebarProfile {
  readonly name: string;
  readonly title: string;
}

export interface SidebarTopic {
  readonly id: TopicId;
  readonly label: string;
  readonly icon: IconName;
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
  readonly onPickTopic: (topic: TopicId) => void;
  readonly onNewConversation: () => void;
  /** Only shown in the drawer layout. */
  readonly onClose: () => void;
}

const CONTACT_SUBJECT = 'Engineering opportunity';

const FOOT_LINK =
  'inline-flex h-7 items-center gap-1.5 text-12.5 text-ink-muted no-underline @max-compact/ma:h-10 @max-compact/ma:text-14';

export function Sidebar({
  profile,
  topics,
  activeTopic,
  links,
  onPickTopic,
  onNewConversation,
  onClose,
}: SidebarProps) {
  return (
    <aside
      aria-label="Portfolio navigation"
      className="flex h-full flex-col gap-7 overflow-y-auto px-3 pt-5.5 pb-4.5"
    >
      <div className="flex items-start gap-2 pr-1 pl-2.5">
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-display text-15 leading-heading font-semibold tracking-identity">
            {profile.name}
          </p>
          <p className="mt-0.75 text-12.5 leading-label text-ink-muted">{profile.title}</p>
        </div>
        <IconButton
          icon="compose"
          iconSize="sm"
          label="New conversation"
          title="New conversation"
          onClick={onNewConversation}
          className="@max-compact/ma:hidden"
        />
        <IconButton
          icon="close"
          label="Close navigation"
          size="touch"
          onClick={onClose}
          className="hidden @max-compact/ma:inline-grid"
        />
      </div>

      <nav aria-label="Topics">
        <ul className="flex flex-col gap-0.5">
          {topics.map((topic) => (
            <li key={topic.id}>
              <TopicButton
                topic={topic}
                active={topic.id === activeTopic}
                onPick={() => {
                  onPickTopic(topic.id);
                }}
              />
            </li>
          ))}
        </ul>
      </nav>

      <SidebarFooter links={links} />
    </aside>
  );
}

function TopicButton({
  topic,
  active,
  onPick,
}: {
  topic: SidebarTopic;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      onClick={onPick}
      className={cn(
        'group flex h-9 w-full cursor-pointer items-center gap-2.75 rounded-sm bg-transparent px-2.5 text-left font-sans text-13.5 leading-none font-book text-ink-muted',
        'transition-[background-color,color,box-shadow] duration-fast ease-standard',
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
    </button>
  );
}

function SidebarFooter({ links }: { links: SidebarLinks }) {
  const mailto = `mailto:${links.email}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;
  return (
    <div className="mt-auto flex flex-col gap-1 px-2.5">
      <a
        href={mailto}
        className="group mb-2 inline-flex w-fit items-center gap-1.5 text-13.5 leading-label font-medium text-ink no-underline"
      >
        Get in touch
        <Icon
          name="arrowUpRight"
          size="sm"
          className="transition-[translate] duration-medium ease-standard group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      </a>
      <p className="-mt-1.5 mb-2.5 text-12.5 wrap-anywhere text-ink-muted">{links.email}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-3 inset-shadow-rule-top">
        <li>
          <ExternalLink href={links.linkedin}>LinkedIn</ExternalLink>
        </li>
        <li>
          <ExternalLink href={links.github}>GitHub</ExternalLink>
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
              Resume
              <VisuallyHidden> (PDF, opens in a new tab)</VisuallyHidden>
            </a>
          ) : (
            <span className={cn(FOOT_LINK, 'cursor-default')}>
              Resume
              <span className="rounded-pill bg-fill px-1.5 py-0.5 text-11 text-ink-muted">
                Soon
              </span>
            </span>
          )}
        </li>
      </ul>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(FOOT_LINK, 'transition-colors duration-fast ease-standard hover:text-ink')}
    >
      {children}
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
    </a>
  );
}
