import type { Instrumentation } from 'next';
import { errorFields, logger } from '@/infrastructure/logging/logger';

function digestOf(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'digest' in error
    ? String(error.digest)
    : null;
}

/**
 * Every uncaught server error, in the same structured shape as the rest of
 * the logs. The digest is the reference the error page shows the visitor.
 * The request path is left out: its query string is the visitor's to keep.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error('request.failed', {
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    digest: digestOf(error),
    ...errorFields(error),
  });
};
