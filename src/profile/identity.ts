import type { Identity } from './schema';

/** Who the site is about, and how it names itself to the services it calls. */
export const identity: Identity = {
  name: 'Marcio Alves',
  firstName: 'Marcio',
  lastName: 'Alves',
  initials: 'MA',
  contact: {
    email: 'marcio.welben@gmail.com',
    linkedin: 'https://www.linkedin.com/in/marcio-montenegro',
    github: 'https://github.com/marcio-w-alves',
  },
  siteHost: 'marciomariani.dev',
  userAgentProduct: 'MarcioAlvesPortfolio',
  nonIdentifyingTerms: ['Freelance'],
};
