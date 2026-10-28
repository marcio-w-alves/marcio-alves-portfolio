import { useId } from 'react';
import { cn } from '../cn';
import { Button, Eyebrow, Icon } from '../primitives';
import { Chip } from './chip';

interface SuggestedQuestionsProps {
  readonly title: string;
  readonly questions: readonly string[];
  readonly onPick: (question: string) => void;
  /** Without it there is no "More questions" control. */
  readonly onShuffle?: (() => void) | undefined;
  /** Rows on the welcome screen, chips for follow-ups under an answer. */
  readonly variant?: 'grid' | 'chips';
}

export function SuggestedQuestions({
  title,
  questions,
  onPick,
  onShuffle,
  variant = 'grid',
}: SuggestedQuestionsProps) {
  const titleId = useId();
  const QuestionList = variant === 'grid' ? QuestionRows : QuestionChips;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <Eyebrow id={titleId}>{title}</Eyebrow>
        {onShuffle && (
          <Button variant="ghost" size="sm" onClick={onShuffle}>
            <Icon name="shuffle" size="sm" />
            More questions
          </Button>
        )}
      </div>
      <QuestionList labelledBy={titleId} questions={questions} onPick={onPick} />
    </div>
  );
}

interface QuestionListProps {
  readonly labelledBy: string;
  readonly questions: readonly string[];
  readonly onPick: (question: string) => void;
}

function QuestionRows({ labelledBy, questions, onPick }: QuestionListProps) {
  return (
    <ul aria-labelledby={labelledBy} className="m-0 grid list-none grid-cols-suggestions gap-2 p-0">
      {questions.map((question) => (
        <li key={question}>
          <button
            type="button"
            onClick={() => {
              onPick(question);
            }}
            className={cn(
              'group flex size-full min-h-12.5 cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left font-sans text-14.5 leading-label font-normal',
              'rounded-md border border-border bg-transparent text-ink',
              'transition-[background-color,border-color] duration-fast ease-standard hover:border-border-strong hover:bg-surface',
              '@max-phone/ma:min-h-13',
            )}
          >
            <span className="min-w-0 flex-1">{question}</span>
            <Icon
              name="arrowUpRight"
              size="sm"
              className="text-ink-faint transition-nudge group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function QuestionChips({ labelledBy, questions, onPick }: QuestionListProps) {
  return (
    <ul aria-labelledby={labelledBy} className="m-0 flex list-none flex-wrap gap-2 p-0">
      {questions.map((question) => (
        <li key={question}>
          <Chip
            onClick={() => {
              onPick(question);
            }}
          >
            <Icon
              name="cornerDownRight"
              size="xs"
              className="text-ink-faint group-hover:text-accent"
            />
            {question}
          </Chip>
        </li>
      ))}
    </ul>
  );
}
