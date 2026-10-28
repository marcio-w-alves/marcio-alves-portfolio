/**
 * The only subjects the assistant may look up externally, and the exact
 * article for each. Technologies are limited to what Marcio's own record
 * mentions; anything else is not his stack, so it is not this site's to
 * explain.
 *
 * Every title was checked against the live encyclopedia. Some subjects have
 * no article — Core Web Vitals, for one — and are listed with `null`, so the
 * assistant says there is no public reference instead of reaching for a
 * near miss.
 */
export const TECHNOLOGY_REFERENCES = {
  React: 'React (software)',
  TypeScript: 'TypeScript',
  'Next.js': 'Next.js',
  JavaScript: 'JavaScript',
  'Node.js': 'Node.js',
  'REST APIs': 'REST',
  PostgreSQL: 'PostgreSQL',
  Redis: 'Redis',
  AWS: 'Amazon Web Services',
  'Amazon S3': 'Amazon S3',
  GitLab: 'GitLab',
  'CI/CD': 'CI/CD',
  Kotlin: 'Kotlin (programming language)',
  Android: 'Android (operating system)',
  Angular: 'Angular (web framework)',
  AngularJS: 'AngularJS',
  Redux: 'Redux (software)',
  'Server-side rendering': 'Server-side scripting',
  'progressive web apps': 'Progressive web app',
  microservices: 'Microservices',
  accessibility: 'Web accessibility',
  'SEO Optimization': 'Search engine optimization',
  'Design Systems': 'Design system',
  'Responsive Design': 'Responsive web design',
  'Agile Methodologies': 'Agile software development',
  'web performance': 'Web performance',
  'Core Web Vitals': null,
} as const satisfies Record<string, string | null>;

export type ReferencedTechnology = keyof typeof TECHNOLOGY_REFERENCES;

export const REFERENCED_TECHNOLOGIES = Object.keys(TECHNOLOGY_REFERENCES) as [
  ReferencedTechnology,
  ...ReferencedTechnology[],
];

/**
 * "Deel" alone is a disambiguation page; the company's article has its own
 * title. The other employers have no article.
 */
export const COMPANY_REFERENCES: Readonly<Record<string, string>> = {
  deel: 'Deel (company)',
};
