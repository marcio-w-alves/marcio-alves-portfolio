import type { Overrides } from '@/core/i18n/format';
import type { UiMessages } from '@/ui/i18n/ui-messages';

/**
 * Where the Portuguese interface says something his own way. Everything else
 * is the default Portuguese interface (`src/ui/i18n/pt-BR.ts`); `{firstName}`
 * and `{name}` are filled from the record.
 */
export const ui: Overrides<UiMessages> = {
  emailSubject: 'Oportunidade de engenharia',
  actions: { roleQuestion: 'Me fale sobre o trabalho dele na {company}.' },
};
