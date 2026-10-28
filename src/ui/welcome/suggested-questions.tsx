import { useId } from 'react';
import { cn } from '../cn';
import { Eyebrow, Icon } from '../primitives';
import { Chip } from './chip';

/** A question to offer. The chip shows `label` where one is given, the question itself otherwise. */
export interface QuestionChoice {
  readonly question: string;
  readonly label?: string | undefined;
}

interface SuggestedQuestionsProps {
  readonly title: string;
  readonly questions: readonly QuestionChoice[];
  /** Receives the full question, whatever the chip shows. */
  readonly onPick: (question: string) => void;
  /** Centred under the welcome composer, flush with the text under an answer. */
  readonly align?: 'start' | 'center';
  /** Where the context makes the title obvious, it is kept for screen readers only. */
  readonly hideTitle?: boolean;
}

export function SuggestedQuestions({
  title,
  questions,
  onPick,
  align = 'start',
  hideTitle = false,
}: SuggestedQuestionsProps) {
  const titleId = useId();
  const centred = align === 'center';

  return (
    <div className={cn('flex flex-col gap-2.5', centred && 'items-center')}>
      <Eyebrow id={titleId} className={cn(hideTitle && 'sr-only')}>
        {title}
      </Eyebrow>
      <ul
        aria-labelledby={titleId}
        className={cn('m-0 flex list-none flex-wrap gap-2 p-0', centred && 'justify-center')}
      >
        {questions.map(({ question, label }) => (
          <li key={question}>
            <Chip
              onClick={() => {
                onPick(question);
              }}
            >
              {label ?? question}
              <Icon name="arrowUpRight" size="xs" className="text-ink-faint group-hover:text-ink" />
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
