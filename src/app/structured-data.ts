import { knowledge } from './site-knowledge';

/** The owner as a schema.org Person, from the record. */
export function personStructuredData(url: URL) {
  const { profile, contact, skills } = knowledge;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.title,
    description: profile.summary,
    url: url.href,
    sameAs: [contact.linkedin, contact.github],
    knowsAbout: skills.flatMap(({ items }) => items),
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
