import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import type { ComposerStatus, ComposerVariant } from '@/ui/composer';
import { Eyebrow } from '@/ui/primitives';
import { ComposerSpecimen } from '../../composer/composer-specimen';

// The design's ComposerStates artboard: six composers side by side. Two of
// them show the focused look at once, which real focus cannot do, so they draw
// it with `looksFocused`. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

const FOLLOW_UP_PLACEHOLDER = 'Ask a follow-up question...';

interface State {
  readonly label: string;
  readonly variant: ComposerVariant;
  readonly status: ComposerStatus;
  readonly placeholder?: string;
  readonly initialValue?: string;
  readonly looksFocused?: boolean;
}

const STATES: readonly State[] = [
  { label: 'Idle · empty', variant: 'hero', status: 'idle' },
  { label: 'Focused', variant: 'hero', status: 'idle', looksFocused: true },
  {
    label: 'Typing · multiline',
    variant: 'hero',
    status: 'idle',
    initialValue: 'What did he build at Deel,\nand how were the performance gains measured?',
    looksFocused: true,
  },
  {
    label: 'Streaming · stop available',
    variant: 'dock',
    status: 'streaming',
    placeholder: FOLLOW_UP_PLACEHOLDER,
  },
  {
    label: 'Disabled',
    variant: 'dock',
    status: 'unavailable',
    placeholder: 'The assistant is unavailable right now',
  },
  {
    label: 'Dock · without preview notice',
    variant: 'dock',
    status: 'idle',
    placeholder: FOLLOW_UP_PLACEHOLDER,
  },
];

export default function ComposerStatesFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const { welcome } = knowledgeBase;
  return (
    <div className="grid min-h-screen grid-cols-2 content-start gap-x-8 gap-y-10 p-10">
      {STATES.map((state) => (
        <section key={state.label} className="flex flex-col gap-3">
          <Eyebrow>{state.label}</Eyebrow>
          <ComposerSpecimen
            variant={state.variant}
            status={state.status}
            placeholder={state.placeholder ?? welcome.placeholder}
            helper={welcome.helper}
            maxLength={MAX_QUESTION_LENGTH}
            initialValue={state.initialValue}
            looksFocused={state.looksFocused}
          />
        </section>
      ))}
    </div>
  );
}
