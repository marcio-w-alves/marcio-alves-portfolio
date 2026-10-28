export type LogValue = string | number | boolean | null;

/**
 * Flat and primitive on purpose: a request, an error or a conversation cannot
 * be dropped into a log line whole, so nothing reaches the logs that was not
 * chosen field by field.
 */
export type LogFields = Readonly<Record<string, LogValue>> & {
  readonly level?: never;
  readonly event?: never;
  readonly time?: never;
};

export type LogLevel = 'info' | 'warn' | 'error';

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

interface Options {
  readonly write?: (level: LogLevel, line: string) => void;
  readonly now?: () => Date;
}

/** Warnings and errors go to stderr, so the platform marks them as such. */
function writeToConsole(level: LogLevel, line: string): void {
  if (level === 'info') console.log(line);
  else console.error(line);
}

/**
 * One JSON object per line — level, event name, timestamp, then the fields —
 * the shape Vercel's log ingestion parses and lets you filter on.
 */
export function createLogger({ write = writeToConsole, now = () => new Date() }: Options = {}) {
  function log(level: LogLevel, event: string, fields: LogFields = {}): void {
    write(level, JSON.stringify({ level, event, time: now().toISOString(), ...fields }));
  }
  const logger: Logger = {
    info: (event, fields) => {
      log('info', event, fields);
    },
    warn: (event, fields) => {
      log('warn', event, fields);
    },
    error: (event, fields) => {
      log('error', event, fields);
    },
  };
  return logger;
}

/** What to keep of something thrown: its kind, what it said, and where it came from. */
export function errorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorName: 'NonError', errorMessage: String(error) };
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack ?? null,
  };
}

export const logger = createLogger();
