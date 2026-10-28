import type { SiteProfile } from '@/site/site-profile';
import { fixtureAnswers } from './answers';
import { fixtureBrand } from './brand';
import { fixtureSiteCopy, fixtureUiCopy } from './copy';
import { fixtureKnowledge } from './knowledge';

/** The fictional person as the pages are built from them. */
export const fixtureSiteProfile: SiteProfile = {
  knowledge: fixtureKnowledge,
  brand: fixtureBrand,
  copy: { en: { answers: fixtureAnswers, ui: fixtureUiCopy, site: fixtureSiteCopy } },
};
