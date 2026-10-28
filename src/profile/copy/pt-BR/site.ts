import type { Overrides } from '@/core/i18n/format';
import type { SiteCopy } from '@/site/site-copy';

/**
 * Where the Portuguese pages describe themselves his own way. Everything else
 * is the default (`src/site/site-copy.ts`); `{name}`, `{firstName}` and
 * `{title}` are filled from the record.
 */
export const site: Overrides<SiteCopy> = {
  description:
    'Portfólio de {name}, {title}. Pergunte ao assistente de IA sobre a experiência documentada dele.',
};
