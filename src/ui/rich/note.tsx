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
    <aside className="bg-sidebar flex animate-block-enter items-start gap-2.5 rounded-control px-3.5 py-2.75 text-13.5 leading-body text-ink-muted">
      <Icon name={icon} size="sm" className="mt-0.5 text-ink-faint" />
      <p>
        <span className="mb-0.5 block font-mono text-11 leading-normal font-medium tracking-caps text-ink uppercase">
          {label}
        </span>
        <InlineText text={text} />
      </p>
    </aside>
  );
}
