import { validateProfile, type SiteEntry } from '@/profile/schema';
import { fixtureBrand } from './brand';
import { fixtureCopy } from './copy';
import { fixtureIdentity } from './identity';
import { fixtureKnowledge } from './knowledge';

export const fixtureSiteAllowList: readonly SiteEntry[] = [
  {
    subject: { kind: 'project', id: 'pipewright' },
    urls: ['https://pipewright.example/'],
    termsNote: "Ada's own product.",
  },
  {
    subject: { kind: 'company', id: 'acme' },
    urls: ['https://www.acme.example/about'],
    termsNote: 'Company page; robots.txt allows it.',
  },
];

/**
 * The fictional person as a whole profile, validated like the owner's.
 * `pnpm test:fork` puts it in place of `@/profile`, the way a fork would put
 * its own, to prove the tests outside the profile hold for anyone's.
 */
export const profile = validateProfile({
  identity: fixtureIdentity,
  locales: ['en'],
  knowledge: fixtureKnowledge,
  siteAllowList: fixtureSiteAllowList,
  brand: fixtureBrand,
  copy: fixtureCopy,
  evaluation: [],
});
