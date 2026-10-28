import { describe, expect, it } from 'vitest';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import {
  homeStructuredData,
  personStructuredData,
  serializeStructuredData,
  topicStructuredData,
} from './structured-data';

const knowledge = localize(fixtureKnowledge, 'en');

describe('personStructuredData', () => {
  const person = personStructuredData(knowledge, new URL('https://ada.example'));

  it('describes the person from the record, at the canonical address', () => {
    expect(person).toMatchObject({
      '@type': 'Person',
      '@id': 'https://ada.example/#person',
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

  it('names where the person works now, studied, lives and which languages they speak', () => {
    const current = knowledge.experience.find((role) => role.current);
    expect(person.worksFor).toEqual({ '@type': 'Organization', name: current?.company });
    expect(person.alumniOf).toEqual({
      '@type': 'CollegeOrUniversity',
      name: knowledge.education.school,
    });
    expect(person.knowsLanguage).toEqual(knowledge.languages.map(({ name }) => name));
    expect(person.homeLocation.address.addressCountry).toBe(knowledge.profile.location.country);
  });

  it('does not claim coursework as expertise', () => {
    const courses = knowledge.certifications.map(({ name }) => name);

    expect(courses.length).toBeGreaterThan(0);
    expect(person.knowsAbout.some((topic) => courses.includes(topic))).toBe(false);
  });
});

describe('homeStructuredData', () => {
  it('presents the home page as a ProfilePage about the Person, on the WebSite', () => {
    const graph = homeStructuredData(knowledge, new URL('https://ada.example'))['@graph'];
    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(['WebSite', 'ProfilePage', 'Person']);
    expect(graph[1]).toMatchObject({ mainEntity: { '@id': 'https://ada.example/#person' } });
  });
});

describe('topicStructuredData', () => {
  it('places a topic page one step below the home page', () => {
    const crumbs = topicStructuredData(
      knowledge,
      new URL('https://ada.example'),
      'Experience',
      '/experience',
    );
    expect(crumbs.itemListElement.map(({ name, item }) => [name, item])).toEqual([
      ['Ada Rivera', 'https://ada.example/'],
      ['Experience', 'https://ada.example/experience'],
    ]);
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
