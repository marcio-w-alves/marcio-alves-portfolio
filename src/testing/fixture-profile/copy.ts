import type { Overrides } from '@/core/i18n/format';
import type { Translations } from '@/core/i18n/locale';
import type { SiteCopy } from '@/site/site-copy';
import type { LocaleCopy } from '@/site/site-profile';
import type { UiMessages } from '@/ui/i18n/ui-messages';
import { fixtureAnswers, fixturePortugueseAnswers } from './answers';

/** How the fictional person words the interface and the pages differently from the defaults. */
export const fixtureUiCopy: Overrides<UiMessages> = {
  emailSubject: 'Platform role',
  actions: { roleQuestion: 'What did she do at {company}?' },
};

export const fixtureSiteCopy: Overrides<SiteCopy> = {
  description: 'Portfolio of {name}, {title}. Ask its assistant about her platform work.',
};

export const fixturePortugueseUiCopy: Overrides<UiMessages> = {
  emailSubject: 'Vaga de plataforma',
  actions: { roleQuestion: 'O que ela fez na {company}?' },
};

export const fixturePortugueseSiteCopy: Overrides<SiteCopy> = {
  description:
    'Portfólio de {name}, {title}. Pergunte ao assistente sobre o trabalho dela com plataformas.',
};

/** Everything the fictional person's site writes, in English and in Portuguese. */
export const fixtureCopy: Translations<LocaleCopy> = {
  en: { answers: fixtureAnswers, ui: fixtureUiCopy, site: fixtureSiteCopy },
  'pt-BR': {
    answers: fixturePortugueseAnswers,
    ui: fixturePortugueseUiCopy,
    site: fixturePortugueseSiteCopy,
  },
};
