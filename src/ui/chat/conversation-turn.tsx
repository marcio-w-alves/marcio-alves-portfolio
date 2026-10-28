import type { TopicId } from '@/core/chat/topic-id';
import type { AssistantMessage as Answer, Feedback, Message } from '@/core/conversation/messages';
import { toPlainText } from '@/core/conversation/plain-text';
import { interpolate } from '@/core/i18n/format';
import { useMessages } from '../i18n/i18n-provider';
import { AssistantMessage, type AssistantIdentity } from './assistant-message';
import { copyText } from './copy-text';

interface ConversationTurnProps {
  readonly message: Message;
  /** The answer as it should look right now: typed out so far, or whole. */
  readonly view: (answer: Answer) => Answer;
  /** Follow-ups are only offered under the newest answer. */
  readonly isLatest: boolean;
  readonly topicLabel: (topic: TopicId) => string;
  readonly assistant: AssistantIdentity;
  /** An answer is on its way, here or on another page, so nothing may ask another question. */
  readonly busy: boolean;
  readonly onAsk: (question: string) => void;
  readonly onRetry: (answerId: string) => void;
  readonly onEdit: (answerId: string) => void;
  readonly onRate: (answerId: string, feedback: Feedback) => void;
  readonly onAskFollowUp: () => void;
}

/** One entry of the conversation: the visitor's question, or an answer. */
export function ConversationTurn({
  message,
  view,
  isLatest,
  topicLabel,
  assistant,
  busy,
  onAsk,
  onRetry,
  onEdit,
  onRate,
  onAskFollowUp,
}: ConversationTurnProps) {
  const messages = useMessages();
  if (message.role === 'user') {
    return (
      <li className="flex animate-turn justify-end">
        <p className="m-0 max-w-bubble rounded-bubble bg-fill px-4 py-2.5 text-15 leading-reading wrap-anywhere whitespace-pre-wrap text-ink @max-phone/ma:max-w-bubble-phone">
          <span className="sr-only">{messages.conversation.youAsked} </span>
          {message.text}
        </p>
      </li>
    );
  }

  const company = message.related?.company;
  return (
    <li className="animate-turn">
      <AssistantMessage
        message={view(message)}
        assistant={assistant}
        busy={busy}
        isLatest={isLatest}
        topicLabel={
          message.kind === 'intro' && message.topicId ? topicLabel(message.topicId) : undefined
        }
        related={
          company
            ? {
                label: interpolate(messages.actions.viewRole, { company }),
                onView: () => {
                  onAsk(interpolate(messages.actions.roleQuestion, { company }));
                },
              }
            : undefined
        }
        onFollowUp={onAsk}
        onCopy={(shown) => copyText(toPlainText(shown.parts))}
        onRetry={onRetry}
        onEdit={onEdit}
        onRate={onRate}
        onAskFollowUp={onAskFollowUp}
      />
    </li>
  );
}
