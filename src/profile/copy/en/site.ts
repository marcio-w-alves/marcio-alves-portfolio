import type { Overrides } from '@/core/i18n/format';
import type { SiteCopy } from '@/site/site-copy';

/**
 * Where the pages describe themselves his own way. Everything else is the
 * default (`src/site/site-copy.ts`); `{name}`, `{firstName}` and `{title}` are
 * filled from the record.
 */
export const site: Overrides<SiteCopy> = {
  description:
    'Portfolio of {name}, {title}. Ask its AI assistant about his documented experience.',
};
