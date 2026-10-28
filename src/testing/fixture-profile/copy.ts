import type { Overrides } from '@/core/i18n/format';
import type { SiteCopy } from '@/site/site-copy';
import type { UiMessages } from '@/ui/i18n/ui-messages';

/** How the fictional person words the interface and the pages differently from the defaults. */
export const fixtureUiCopy: Overrides<UiMessages> = {
  emailSubject: 'Platform role',
  actions: { roleQuestion: 'What did she do at {company}?' },
};

export const fixtureSiteCopy: Overrides<SiteCopy> = {
  description: 'Portfolio of {name}, {title}. Ask its assistant about her platform work.',
};
