import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { personStructuredData, serializeStructuredData } from './structured-data';

const knowledge = localize(fixtureKnowledge, 'en');

describe('personStructuredData', () => {
  const person = personStructuredData(knowledge, new URL('https://ada.example'));

  it('describes the person from the record, at the canonical address', () => {
    expect(person).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Rivera',
      jobTitle: 'Principal Platform Engineer',
      description: 'Ada is a platform engineer who builds internal developer platforms.',
      url: 'https://ada.example/',
      sameAs: [
        'https://www.linkedin.com/in/ada-rivera-example',
        'https://github.com/ada-rivera-example',
      ],
      knowsAbout: ['Bazel', 'Kubernetes', 'Go', 'Rust'],
    });
  });

  it('does not claim coursework as expertise', () => {
    const courses = knowledge.certifications.map(({ name }) => name);

    expect(courses.length).toBeGreaterThan(0);
    expect(person.knowsAbout.some((topic) => courses.includes(topic))).toBe(false);
  });
});

describe('serializeStructuredData', () => {
  it('cannot close the script tag it is written into', () => {
    const hostile = { name: '</script><script>alert(1)</script>' };

    const serialized = serializeStructuredData(hostile);

    expect(serialized).not.toContain('</script>');
    expect(JSON.parse(serialized)).toEqual(hostile);
  });
});
