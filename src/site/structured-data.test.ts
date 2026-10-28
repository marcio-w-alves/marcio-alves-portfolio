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
const HOME = {
  url: new URL('https://ada.example'),
  locale: 'en' as const,
  image: new URL('https://ada.example/brand/share-image.png'),
};

describe('personStructuredData', () => {
  const person = personStructuredData(knowledge, HOME);

  it('describes the person from the record, at the canonical address', () => {
    expect(person).toMatchObject({
      '@type': 'Person',
      '@id': 'https://ada.example/#person',
      name: 'Ada Rivera',
      jobTitle: 'Principal Platform Engineer',
      description: 'Ada is a platform engineer who builds internal developer platforms.',
      url: 'https://ada.example/',
      image: 'https://ada.example/brand/share-image.png',
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
    const graph = homeStructuredData(knowledge, HOME)['@graph'];
    const types = graph.map((node) => node['@type']);
    expect(types).toEqual(['WebSite', 'ProfilePage', 'Person']);
    expect(graph[0]).toMatchObject({ inLanguage: 'en' });
    expect(graph[1]).toMatchObject({ mainEntity: { '@id': 'https://ada.example/#person' } });
  });

  it('presents the Portuguese home page as its own, with the Person read in Portuguese', () => {
    const translated = {
      ...fixtureKnowledge,
      profile: {
        ...fixtureKnowledge.profile,
        title: { en: 'Principal Platform Engineer', 'pt-BR': 'Engenheira de Plataforma Principal' },
        summary: { en: 'Builds platforms.', 'pt-BR': 'Constrói plataformas.' },
      },
    };
    const graph = homeStructuredData(localize(translated, 'pt-BR'), {
      url: new URL('https://ada.example/pt'),
      locale: 'pt-BR',
      image: new URL('https://ada.example/pt/brand/share-image.png'),
    })['@graph'];

    expect(graph[0]).toMatchObject({ url: 'https://ada.example/pt', inLanguage: 'pt-BR' });
    expect(graph[2]).toMatchObject({
      '@id': 'https://ada.example/pt#person',
      jobTitle: 'Engenheira de Plataforma Principal',
      description: 'Constrói plataformas.',
      image: 'https://ada.example/pt/brand/share-image.png',
    });
  });
});

describe('topicStructuredData', () => {
  it('places a topic page one step below the home page', () => {
    const crumbs = topicStructuredData(
      knowledge,
      new URL('https://ada.example'),
      'Experience',
      new URL('https://ada.example/experience'),
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
