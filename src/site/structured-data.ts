import type { Knowledge } from '@/core/knowledge/schema';

const CONTEXT = 'https://schema.org';

/** The owner as a schema.org Person, from the record. */
export function personStructuredData(
  { profile, contact, skills, experience, education, languages }: Knowledge,
  url: URL,
) {
  const current = experience.find((role) => role.current);
  const { city, country } = profile.location;
  return {
    '@type': 'Person',
    '@id': new URL('#person', url).href,
    name: profile.name,
    jobTitle: profile.title,
    description: profile.summary,
    url: url.href,
    image: new URL('/opengraph-image', url).href,
    sameAs: [contact.linkedin, contact.github],
    knowsAbout: skills.flatMap(({ items }) => items),
    knowsLanguage: languages.map(({ name }) => name),
    alumniOf: { '@type': 'CollegeOrUniversity', name: education.school },
    ...(current ? { worksFor: { '@type': 'Organization', name: current.company } } : {}),
    homeLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        ...(city ? { addressLocality: city } : {}),
        addressCountry: country,
      },
    },
  };
}

/**
 * The home page as search engines read a portfolio: a ProfilePage about the
 * Person, on a WebSite that names them.
 */
export function homeStructuredData(knowledge: Knowledge, url: URL) {
  const person = personStructuredData(knowledge, url);
  return {
    '@context': CONTEXT,
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': new URL('#website', url).href,
        url: url.href,
        name: knowledge.profile.name,
        inLanguage: 'en',
      },
      {
        '@type': 'ProfilePage',
        '@id': new URL('#profile', url).href,
        url: url.href,
        name: `${knowledge.profile.name} — ${knowledge.profile.title}`,
        isPartOf: { '@id': new URL('#website', url).href },
        mainEntity: { '@id': person['@id'] },
      },
      person,
    ],
  };
}

/** A topic page's place in the site, as a breadcrumb trail from the home page. */
export function topicStructuredData(knowledge: Knowledge, url: URL, label: string, path: string) {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: knowledge.profile.name, item: url.href },
      { '@type': 'ListItem', position: 2, name: label, item: new URL(path, url).href },
    ],
  };
}

/**
 * The script tag's content. JSON.stringify leaves `<` as it is, so a value
 * containing `</script>` would close the tag early; the escape keeps the JSON
 * equal and the tag intact.
 */
export function serializeStructuredData(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
