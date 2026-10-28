'use client';

import type { SuggestedQuestion } from '../core/assistant/topics';
import { MAX_QUESTION_LENGTH } from '../core/chat/request';

export const fits = (suggestion: SuggestedQuestion) =>
  suggestion.question.length <= MAX_QUESTION_LENGTH;
