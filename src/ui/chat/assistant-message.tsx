import type { AssistantMessage as Message, Feedback } from '@/core/conversation/messages';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { cn } from '../cn';
import { Button, Eyebrow, Icon, Tag } from '../primitives';
import { SuggestedQuestions } from '../welcome';
import { AnswerActions } from './answer-actions';
import { AnswerBody } from './answer-body';
import { AssistantAvatar } from './assistant-avatar';
import { ThinkingDots } from './thinking-dots';

interface AssistantMessageProps {
  readonly message: Message;
  /** Follow-ups are only offered under the newest answer. */
  readonly isLatest: boolean;
  /** Shown beside the name on a topic's introduction. */
  readonly topicLabel?: string | undefined;
  /** "View Deel experience", when the answer is about one role. */
  readonly relatedLabel?: string | undefined;
  readonly onFollowUp: (question: string) => void;
  readonly onCopy: (message: Message) => Promise<boolean>;
  readonly onRetry: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onRate: (id: string, feedback: Feedback) => void;
  readonly onViewRelated: (message: Message) => void;
  readonly onAskFollowUp: () => void;
}

/**
 * One answer, in whichever state it is: waiting, streaming, done, stopped or
 * failed — with its sources, actions and follow-ups once it is done.
 */
export function AssistantMessage({
  message,
  isLatest,
  topicLabel,
  relatedLabel,
  onFollowUp,
  onCopy,
  onRetry,
  onEdit,
  onRate,
  onViewRelated,
  onAskFollowUp,
}: AssistantMessageProps) {
  const isIntro = message.kind === 'intro';
  const done = message.status === 'done';

  return (
    <article
      aria-label="Answer from Marcio's portfolio assistant"
      className="grid grid-cols-answer gap-x-4 @max-phone/ma:grid-cols-1 @max-phone/ma:gap-y-2"
    >
      <div className="@max-phone/ma:hidden">
        <AssistantAvatar />
      </div>
      <div className="flex min-w-0 flex-col gap-3.5">
        <div
          className={cn(
            'flex min-h-7 items-center gap-2 text-13 text-ink-muted',
            isIntro && 'mb-0.5 gap-2.5 after:h-px after:flex-1 after:bg-border',
          )}
        >
          <span className="hidden @max-phone/ma:grid">
            <AssistantAvatar inline />
          </span>
          <strong className="font-medium text-ink">{knowledgeBase.assistant.name}</strong>
          {topicLabel && <Tag tone="accent">{topicLabel}</Tag>}
        </div>

        {message.status === 'pending' && (
          <p className="m-0 flex min-h-7 items-center gap-2.5 text-14 text-ink-muted">
            <ThinkingDots />
            Reading Marcio&apos;s documented experience…
          </p>
        )}

        {message.parts.length > 0 && (
          <AnswerBody parts={message.parts} streaming={message.status === 'streaming'} />
        )}

        {message.status === 'stopped' && (
          <p className="m-0 font-mono text-12 leading-label text-ink-muted">Response stopped</p>
        )}

        {message.status === 'error' && (
          <div
            role="alert"
            className="bg-danger-bg flex flex-col gap-3 rounded-md px-4 py-3.5 text-danger"
          >
            <p className="m-0 flex items-center gap-2 text-14.5 font-semibold">
              <Icon name="alert" size="sm" />
              Couldn&apos;t load this answer
            </p>
            <p className="m-0 text-14 leading-body text-ink">
              {message.error?.message ?? 'Something went wrong.'} Your question is saved, so you can
              try again or edit it first.
            </p>
            <div className="flex flex-wrap gap-2">
              {message.error?.retryable !== false && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onRetry(message.id);
                  }}
                >
                  <Icon name="refresh" size="sm" />
                  Try again
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  onEdit(message.id);
                }}
              >
                <Icon name="pencil" size="sm" />
                Edit question
              </Button>
            </div>
          </div>
        )}

        {done && !isIntro && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Eyebrow as="span">Sources</Eyebrow>
            {message.sources.map((source) => (
              <span
                key={source.id}
                className="bg-sidebar inline-flex h-6 items-center gap-1.5 rounded-xs px-2 font-mono text-11.5 leading-none whitespace-nowrap text-ink-muted"
              >
                <Icon name="file" size="xs" />
                {source.label}
              </span>
            ))}
          </div>
        )}

        {done && !isIntro && (
          <AnswerActions
            feedback={message.feedback}
            onCopy={() => onCopy(message)}
            onAskFollowUp={onAskFollowUp}
            related={
              relatedLabel
                ? {
                    label: relatedLabel,
                    onView: () => {
                      onViewRelated(message);
                    },
                  }
                : null
            }
            onRate={(feedback) => {
              onRate(message.id, feedback);
            }}
          />
        )}

        {done && isLatest && message.followUps.length > 0 && (
          <div className="flex flex-col gap-2.5 pt-0.5">
            <SuggestedQuestions
              title={isIntro ? 'Suggested questions' : 'Ask a follow-up'}
              questions={message.followUps.map((question) => ({ question }))}
              onPick={onFollowUp}
            />
          </div>
        )}
      </div>
    </article>
  );
}
