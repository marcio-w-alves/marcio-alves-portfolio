'use client';

import { useState } from 'react';
import type { AssistantMessage as Answer, Feedback } from '@/core/conversation/messages';
import { toPlainText } from '@/core/conversation/plain-text';
import { AssistantMessage } from '@/ui/chat/assistant-message';
import { copyText } from '@/ui/chat/copy-text';

/**
 * On its own artboard the answer is the newest one and keeps its rating
 * locally, as the design's does; there is no conversation to send to.
 */
interface AssistantMessageSpecimenProps {
  readonly message: Answer;
  readonly assistantName: string;
  readonly relatedLabel: string | undefined;
}

export function AssistantMessageSpecimen({
  message,
  assistantName,
  relatedLabel,
}: AssistantMessageSpecimenProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  return (
    <AssistantMessage
      message={{ ...message, feedback }}
      assistantName={assistantName}
      isLatest
      relatedLabel={relatedLabel}
      onFollowUp={() => undefined}
      onCopy={(answer) => copyText(toPlainText(answer.parts))}
      onRetry={() => undefined}
      onEdit={() => undefined}
      onRate={(_id, rating) => {
        setFeedback((current) => (current === rating ? null : rating));
      }}
      onViewRelated={() => undefined}
      onAskFollowUp={() => undefined}
    />
  );
}
