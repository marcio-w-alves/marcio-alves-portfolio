import type { NoteTone } from '@/core/assistant/components';
import { InlineText } from '../format/inline';
import { Icon, type IconName } from '../primitives';

const TONES: Readonly<Record<NoteTone, { readonly label: string; readonly icon: IconName }>> = {
  inference: { label: 'Assessment', icon: 'compass' },
  example: { label: 'Illustrative example', icon: 'code' },
  gap: { label: 'Not documented', icon: 'info' },
  info: { label: 'Note', icon: 'info' },
};

interface NoteProps {
  readonly tone: NoteTone;
  readonly text: string;
}

export function Note({ tone, text }: NoteProps) {
  const { label, icon } = TONES[tone];
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
