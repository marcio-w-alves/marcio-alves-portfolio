import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MAX_QUESTION_LENGTH } from '@/core/assistant/system1/router';
import { knowledge } from '../../site-knowledge';
import type { ComposerStatus, ComposerVariant } from '@/ui/composer';
import { Eyebrow } from '@/ui/primitives';
import { ComposerSpecimen, DockSpecimen } from './composer-specimen';

const { welcome } = knowledge;

// Every composer state from the design, in both variants, for checking them
// against the artboards. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

const FOLLOW_UP_PLACEHOLDER = 'Ask a follow-up question...';

interface Specimen {
  readonly label: string;
  readonly status: ComposerStatus;
  readonly placeholder?: string;
  readonly initialValue?: string;
  readonly focusOnMount?: boolean;
}

const STATES: readonly Specimen[] = [
  { label: 'Idle · empty', status: 'idle' },
  { label: 'Focused', status: 'idle', focusOnMount: true },
  {
    label: 'Typing · multiline',
    status: 'idle',
    initialValue: 'What did he build at Deel,\nand how were the performance gains measured?',
  },
  { label: 'Streaming · stop available', status: 'streaming' },
  {
    label: 'Unavailable',
    status: 'unavailable',
    placeholder: 'The assistant is unavailable right now',
  },
];

const VARIANTS: readonly { readonly variant: ComposerVariant; readonly placeholder: string }[] = [
  { variant: 'hero', placeholder: welcome.placeholder },
  { variant: 'dock', placeholder: FOLLOW_UP_PLACEHOLDER },
];

export default function ComposerWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="@container/ma flex flex-col gap-10 p-8">
      {VARIANTS.map(({ variant, placeholder }) => (
        <section key={variant} className="flex flex-col gap-4">
          <Eyebrow as="h2">{`Composer · ${variant}`}</Eyebrow>
          <div className="grid grid-cols-2 gap-x-8 gap-y-10">
            {STATES.map((state) => (
              <div key={state.label} className="flex flex-col gap-3">
                <Eyebrow>{state.label}</Eyebrow>
                <ComposerSpecimen
                  variant={variant}
                  status={state.status}
                  placeholder={state.placeholder ?? placeholder}
                  helper={welcome.helper}
                  maxLength={MAX_QUESTION_LENGTH}
                  initialValue={state.initialValue}
                  focusOnMount={variant === 'hero' && state.focusOnMount}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-4">
        <Eyebrow as="h2">Dock · jump to latest</Eyebrow>
        <div className="pt-12">
          <DockSpecimen
            status="idle"
            placeholder={FOLLOW_UP_PLACEHOLDER}
            helper={welcome.helper}
            maxLength={MAX_QUESTION_LENGTH}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <Eyebrow as="h2">Phone · 390px</Eyebrow>
        <div className="@container/ma flex w-97.5 flex-col gap-10 pt-12">
          <ComposerSpecimen
            variant="hero"
            status="idle"
            placeholder={welcome.placeholder}
            helper={welcome.helper}
            maxLength={MAX_QUESTION_LENGTH}
          />
          <DockSpecimen
            status="streaming"
            placeholder={FOLLOW_UP_PLACEHOLDER}
            helper={welcome.helper}
            maxLength={MAX_QUESTION_LENGTH}
          />
        </div>
      </section>
    </main>
  );
}
