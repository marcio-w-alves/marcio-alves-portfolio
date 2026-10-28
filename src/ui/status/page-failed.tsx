import { interpolate } from '@/core/i18n/format';
import type { UiMessages } from '../i18n/ui-messages';
import { Button } from '../primitives';
import { StatusNotice } from './status-notice';

interface PageFailedProps {
  readonly error: unknown;
  readonly retry: () => void;
  readonly messages: UiMessages['pageFailed'];
}

/** Server errors reach the browser stripped of detail, with a digest that matches the server log. */
function digestOf(error: unknown): string | null {
  return error instanceof Error && 'digest' in error && typeof error.digest === 'string'
    ? error.digest
    : null;
}

export function PageFailed({ error, retry, messages }: PageFailedProps) {
  const digest = digestOf(error);
  return (
    <StatusNotice
      failure={messages.failure}
      title={messages.title}
      description={messages.description}
    >
      <Button variant="primary" onClick={retry}>
        {messages.retry}
      </Button>
      {digest ? (
        <p className="text-sm text-ink-muted">{interpolate(messages.reference, { digest })}</p>
      ) : null}
    </StatusNotice>
  );
}
