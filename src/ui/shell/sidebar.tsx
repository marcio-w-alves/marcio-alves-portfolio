import type { ReactNode } from 'react';
import type { TopicId } from '@/core/assistant/topics';
import { cn } from '../cn';
import {
  Button,
  Eyebrow,
  Icon,
  IconButton,
  Tag,
  VisuallyHidden,
  type IconName,
} from '../primitives';
import { Monogram } from './monogram';

export interface SidebarProfile {
  readonly name: string;
  readonly title: string;
  readonly initials: string;
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

const FOOT_LINK =
  'flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-13 text-ink-muted no-underline @max-compact/ma:h-10 @max-compact/ma:text-14';
const FOOT_LINK_INTERACTIVE =
  'transition-colors duration-fast ease-standard hover:bg-hover hover:text-ink';

function ExternalLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <a
      className={cn(FOOT_LINK, FOOT_LINK_INTERACTIVE)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon name={icon} size="sm" />
      <span>{children}</span>
      <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
      <Icon name="arrowUpRight" size="xs" className="ml-auto" />
    </a>
  );
}

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
      className="bg-sidebar flex h-full flex-col gap-6 overflow-y-auto px-3 pt-4 pb-3"
    >
      <div className="flex items-center gap-3 px-1.5 py-1">
        <Monogram initials={profile.initials} />
        <div className="min-w-0 flex-1">
          <p className="text-14.5 leading-heading font-semibold tracking-name">{profile.name}</p>
          <p className="mt-0.5 text-12.5 leading-compact text-ink-muted">{profile.title}</p>
        </div>
        <IconButton
          icon="close"
          label="Close navigation"
          size="touch"
          onClick={onClose}
          className="hidden @max-compact/ma:inline-grid"
        />
      </div>

      <nav aria-label="Topics">
        <Eyebrow className="mb-2 px-2.5">Explore</Eyebrow>
        <ul className="flex flex-col gap-0.5">
          {topics.map((topic) => {
            const active = topic.id === activeTopic;
            return (
              <li key={topic.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    onPickTopic(topic.id);
                  }}
                  className={cn(
                    'group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-left text-14 leading-none font-book text-ink-muted',
                    'transition-[background-color,color,box-shadow] duration-fast ease-standard',
                    '@max-compact/ma:h-11 @max-compact/ma:text-15',
                    active
                      ? 'shadow-raised bg-surface font-medium text-ink'
                      : 'hover:bg-hover hover:text-ink',
                  )}
                >
                  <Icon name={topic.icon} className={cn(active && 'text-accent')} />
                  <span className="min-w-0 flex-1 truncate">{topic.label}</span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-1.5 rounded-full bg-accent transition-[opacity,scale] duration-medium ease-standard',
                      active ? 'scale-100 opacity-100' : 'scale-40 opacity-0',
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-3">
        <ul className="flex flex-col gap-px">
          <li>
            {links.resumeUrl ? (
              <a className={cn(FOOT_LINK, FOOT_LINK_INTERACTIVE)} href={links.resumeUrl} download>
                <Icon name="download" size="sm" />
                <span>Download resume</span>
              </a>
            ) : (
              <span className={FOOT_LINK}>
                <Icon name="download" size="sm" />
                <span>Download resume</span>
                <Tag className="ml-auto">Soon</Tag>
              </span>
            )}
          </li>
          <li>
            <ExternalLink href={links.linkedin} icon="link">
              LinkedIn
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href={links.github} icon="code">
              GitHub
            </ExternalLink>
          </li>
          <li>
            <a className={cn(FOOT_LINK, FOOT_LINK_INTERACTIVE)} href={`mailto:${links.email}`}>
              <Icon name="mail" size="sm" />
              <span>Contact</span>
            </a>
          </li>
        </ul>
        <Button
          onClick={onNewConversation}
          className="h-9.5 w-full justify-start px-3 @max-compact/ma:h-11"
        >
          <Icon name="compose" size="sm" />
          New conversation
        </Button>
      </div>
    </aside>
  );
}
