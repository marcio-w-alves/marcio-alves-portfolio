/** A page that could not be ingested, saying which and why. */
export class PageError extends Error {
  override readonly name: string = 'PageError';
}

/** A failure that may well not happen again: a server error or a dropped connection. */
export class TransientPageError extends PageError {
  override readonly name = 'TransientPageError';
}

export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
