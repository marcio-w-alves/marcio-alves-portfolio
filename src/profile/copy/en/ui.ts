import type { Overrides } from '@/core/i18n/format';
import type { UiMessages } from '@/ui/i18n/ui-messages';

/**
 * Where the interface says something his own way. Everything else is the
 * default English interface (`src/ui/i18n/en.ts`); `{firstName}` and `{name}`
 * are filled from the record.
 */
export const ui: Overrides<UiMessages> = {
  emailSubject: 'Engineering opportunity',
  actions: { roleQuestion: 'Tell me about his time at {company}.' },
};
