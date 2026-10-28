import { brand } from './brand';
import { about } from './copy/en/about';
import { answers } from './copy/en/answers';
import { site } from './copy/en/site';
import { ui } from './copy/en/ui';
import { about as portugueseAbout } from './copy/pt-BR/about';
import { answers as portugueseAnswers } from './copy/pt-BR/answers';
import { site as portugueseSite } from './copy/pt-BR/site';
import { ui as portugueseUi } from './copy/pt-BR/ui';
import { evaluation } from './evaluation/cases';
import { identity } from './identity';
import { knowledge } from './knowledge';
import { locales } from './locales';
import { validateProfile } from './schema';
import { siteAllowList } from './sites/allow-list';

/** The owner of this site. Read only by the roots that wire it, the scripts and the tests. */
export const profile = validateProfile({
  identity,
  locales,
  knowledge,
  siteAllowList,
  brand,
  copy: {
    en: { answers, ui, site, about },
    'pt-BR': {
      answers: portugueseAnswers,
      ui: portugueseUi,
      site: portugueseSite,
      about: portugueseAbout,
    },
  },
  evaluation,
});
