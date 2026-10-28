'use client';

import { useState } from 'react';
import type { AssistantMessage as Answer, Feedback } from '@/core/conversation/messages';
import { toPlainText } from '@/core/conversation/plain-text';
import { roleById } from '@/core/knowledge/knowledge-base';
import { AssistantMessage } from '@/ui/chat/assistant-message';
import { copyText } from '@/ui/chat/copy-text';

/**
 * On its own artboard the answer is the newest one and keeps its rating
 * locally, as the design's does; there is no conversation to send to.
 */
export function AssistantMessageSpecimen({ message }: { readonly message: Answer }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const role = message.related ? roleById(message.related) : undefined;
  return (
    <AssistantMessage
      message={{ ...message, feedback }}
      isLatest
      relatedLabel={role ? `View ${role.company} experience` : undefined}
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
