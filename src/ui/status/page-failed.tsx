import { Button } from '../primitives';
import { StatusNotice } from './status-notice';

interface PageFailedProps {
  readonly error: unknown;
  readonly retry: () => void;
}

/** Server errors reach the browser stripped of detail, with a digest that matches the server log. */
function digestOf(error: unknown): string | null {
  return error instanceof Error && 'digest' in error && typeof error.digest === 'string'
    ? error.digest
    : null;
}

export function PageFailed({ error, retry }: PageFailedProps) {
  const digest = digestOf(error);
  return (
    <StatusNotice
      failure="Error"
      title="This page failed to load"
      description="Something broke on our side while showing it. Try again; if it keeps failing, come back in a few minutes."
    >
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
      {digest ? <p className="text-sm text-ink-muted">Reference {digest}</p> : null}
    </StatusNotice>
  );
}
