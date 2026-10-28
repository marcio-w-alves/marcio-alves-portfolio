import type { AssistantError } from '@/core/chat/events';
import { interpolate, plural } from '@/core/i18n/format';
import type { UiMessages } from '../i18n/ui-messages';

type ErrorMessages = UiMessages['errors'];

const SECONDS_PER_MINUTE = 60;

function whenToRetry(messages: ErrorMessages, locale: string, retryAfterSeconds?: number): string {
  if (retryAfterSeconds === undefined) return messages.retryLater;
  return plural(locale, messages.retryIn, Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE));
}

/** What the visitor reads for a failed answer; the error itself carries only its code. */
export function errorText(
  { code, retryAfterSeconds }: AssistantError,
  messages: ErrorMessages,
  locale: string,
): string {
  return code === 'rate_limited'
    ? interpolate(messages.rateLimited, {
        retry: whenToRetry(messages, locale, retryAfterSeconds),
      })
    : messages[code];
}
