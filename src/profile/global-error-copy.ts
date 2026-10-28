import { identity } from './identity';

/**
 * What the global error page needs of the profile. It replaces the root
 * layout, so it cannot be handed the page's catalog; it reads this instead,
 * which is safe to ship to the browser.
 */
export const globalErrorSubject = { name: identity.name };
