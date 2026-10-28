import type { AssistantError, AssistantErrorCode } from '@/core/chat/events';

const TEXT: Readonly<Record<Exclude<AssistantErrorCode, 'rate_limited'>, string>> = {
  network: "The assistant couldn't be reached. Check your connection and try again.",
  timeout: 'The answer is taking too long. Please try again.',
  interrupted: 'The answer was interrupted. Please try again.',
  rejected: 'That question could not be sent. Try a shorter one.',
  internal: 'Something failed on our side. Please try again.',
};

function whenToRetry(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined) return 'Try again in a few minutes.';
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Try again in ${String(minutes)} minute${minutes > 1 ? 's' : ''}.`;
}

/** What the visitor reads for a failed answer; the error itself carries only its code. */
export function errorText({ code, retryAfterSeconds }: AssistantError): string {
  return code === 'rate_limited'
    ? `Too many questions in a short time. ${whenToRetry(retryAfterSeconds)}`
    : TEXT[code];
}
