import type { NoteTone } from '@/core/chat/components';
import { InlineText } from '../format/inline';
import { useMessages } from '../i18n/i18n-provider';
import { Icon, type IconName } from '../primitives';

const ICONS: Readonly<Record<NoteTone, IconName>> = {
  inference: 'compass',
  example: 'code',
  info: 'info',
};

interface NoteProps {
  readonly tone: NoteTone;
  readonly text: string;
}

export function Note({ tone, text }: NoteProps) {
  const label = useMessages().rich.notes[tone];
  const icon = ICONS[tone];
  return (
    <aside className="flex animate-block-enter items-start gap-2.5 rounded-md bg-ice px-4 py-3 text-13.5 leading-reading text-ink-muted shadow-ring">
      <Icon name={icon} size="sm" className="mt-0.5 text-ink-faint" />
      <p>
        <span className="mb-px block text-12.5 font-semibold text-ink">{label}</span>
        <InlineText text={text} />
      </p>
    </aside>
  );
}
