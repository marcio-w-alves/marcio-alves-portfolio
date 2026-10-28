import type { SiteProfile } from '@/site/site-profile';
import { fixtureBrand } from './brand';
import { fixtureCopy } from './copy';
import { fixtureKnowledge } from './knowledge';

/** The fictional person as the pages are built from them. */
export const fixtureSiteProfile: SiteProfile = {
  knowledge: fixtureKnowledge,
  brand: fixtureBrand,
  copy: fixtureCopy,
};
