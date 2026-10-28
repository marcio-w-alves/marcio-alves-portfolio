import type { Identity } from '@/profile/schema';

/** The fictional person's identity, as a profile's `identity.ts` writes it. */
export const fixtureIdentity: Identity = {
  name: 'Ada Rivera',
  firstName: 'Ada',
  lastName: 'Rivera',
  initials: 'AR',
  contact: {
    email: 'ada@rivera.example',
    linkedin: 'https://www.linkedin.com/in/ada-rivera-example',
    github: 'https://github.com/ada-rivera-example',
  },
  siteHost: 'ada.example',
  userAgentProduct: 'AdaRiveraPortfolio',
  nonIdentifyingTerms: [],
};
