import { describe, expect, it } from 'vitest';
import { createResponseKit } from '@/core/assistant/response-kit';
import { localize } from '@/core/knowledge/localize';
import { rootMetadata } from '@/site/metadata';
import { siteMessages } from '@/site/site-messages';
import { createSiteContent } from '@/site/site-content';
import { publishedLocales } from '@/site/published-locales';
import { profile } from '.';

/**
 * The only tests that name the owner: what this particular record says.
 * Everything a record must satisfy in general is checked by its validation.
 */

const knowledge = localize(profile.knowledge, 'en');

describe("the owner's record", () => {
  it('has Way2b1 as the one current role', () => {
    const current = knowledge.experience.filter((role) => role.current);
    expect(current.map((role) => role.company)).toEqual(['Way2b1']);
  });

  it('cites each role against its own resume section', () => {
    for (const role of knowledge.experience) expect(role.source).toBe(`resume.${role.id}`);
  });

  it('cites every section of the résumé as the résumé itself', () => {
    const resumeSections = Object.entries(knowledge.sourceLabels).filter(([id]) =>
      id.startsWith('resume.'),
    );
    expect(resumeSections.length).toBeGreaterThan(0);
    for (const [id, label] of resumeSections) expect(label, id).toBe('Resume');
  });

  it('attributes every metric to exactly one role', () => {
    const cited = knowledge.experience.flatMap((role) => role.metrics);
    expect(cited).toHaveLength(new Set(cited).size);
    expect([...cited].sort()).toEqual(Object.keys(knowledge.metrics).sort());
  });

  it('states the city Marcio confirmed (POR-40), not one guessed from context', () => {
    expect(knowledge.profile.location.city).toBe('João Pessoa, Paraíba');
  });

  it('labels Roots, Maison Moderne and the freelance work as contracts, and only those', () => {
    const { timeline } = createResponseKit(knowledge, profile.copy.en.answers.labels);
    const block = timeline();
    if (block.component !== 'timeline') throw new Error('timeline() built another block.');
    const contracts = block.props.roles
      .filter((role) => role.badges.some((badge) => badge.kind === 'contract'))
      .map((role) => role.id);
    expect(contracts).toEqual(['roots', 'maison', 'freelance']);
  });

  it('states his availability without naming a city in it', () => {
    expect(knowledge.profile.availability).toBe('Brazil · remote · UTC−3 · open to opportunities');
  });

  it('lists this portfolio as a live project with its stack, repository, site and two outcomes', () => {
    const portfolio = knowledge.projects.find((project) => project.id === 'marciomariani-dev');
    expect(portfolio).toMatchObject({ live: true, status: 'Live' });
    expect(portfolio?.technologies).toEqual(
      expect.arrayContaining(['Next.js', 'React', 'TypeScript', 'Tailwind CSS']),
    );
    expect(portfolio?.links.map((link) => link.url)).toEqual([
      'https://marciomariani.dev',
      'https://github.com/marcio-w-alves/marcio-alves-portfolio',
    ]);
    expect(portfolio?.outcomes).toHaveLength(2);
  });

  it('keeps FictionDraft as a concept, with no site to link to', () => {
    const fictionDraft = knowledge.projects.find((project) => project.id === 'fictiondraft');
    expect(fictionDraft).toMatchObject({ live: false, status: 'Concept', links: [] });
  });

  it('carries none of the typos the résumé review found', () => {
    const record = JSON.stringify(profile.knowledge);
    for (const typo of ['teams.Strong', 'Ci/Cd', 'Ux/Ui', 'Seo Optimization', 'Da Paraíba']) {
      expect(record).not.toContain(typo);
    }
    expect(record).not.toMatch(/\bSEO Optimization\b/i);
  });

  it('gives the model no note that positions him as Staff, only scope as evidence', () => {
    for (const { id, text } of knowledge.notes.passages) {
      expect(text, id).not.toMatch(/staff-level/i);
      expect(text, id).not.toMatch(/posicionamento[^.\n]*staff|staff[^.\n]*posicionamento/i);
      expect(text, id).not.toMatch(/busca escopos dessa senioridade/i);
    }
  });

  it('backs the welcome greeting with his current and recent companies and two headline results', () => {
    const { roles, metrics } = knowledge.welcome.evidence;
    expect(roles).toEqual(['way2b1', 'deel', 'roots']);
    expect(metrics.map((id) => knowledge.metrics[id]?.value)).toEqual(['50%', '30%+']);
  });

  it('names the owner the way the identity does, in one place', () => {
    expect(knowledge.profile.name).toBe(profile.identity.name);
    expect(knowledge.contact.github).toBe(profile.identity.contact.github);
  });
});

describe("the owner's headline", () => {
  const HEADLINE = 'Senior Frontend Engineer';
  const site = createSiteContent(profile.knowledge, profile.copy.en.answers, 'en');
  const copy = siteMessages(site.knowledge, profile.copy.en, 'en').site;
  const metadata = rootMetadata(
    site.knowledge,
    copy,
    new URL(`https://${profile.identity.siteHost}`),
    'en',
  );
  const overview = site.topicCatalog.topicById('overview');

  it('is the headline he chose, on every surface that introduces him', () => {
    expect(knowledge.profile.title).toBe(HEADLINE);
    expect(metadata.title).toBe(`Marcio Alves — ${HEADLINE}`);
    expect(metadata.description).toContain(HEADLINE);
    expect(metadata.openGraph).toMatchObject({ title: metadata.title });
    expect(metadata.twitter).toMatchObject({ title: metadata.title });
    expect(copy.shareImageAlt).toBe(`Marcio Alves, ${HEADLINE}`);
    expect(knowledge.welcome.description).toMatch(/^Senior frontend engineer with 10\+ years/);
    expect(overview.intro).toContain(HEADLINE);
  });

  it('never calls him Staff-level where he is introduced', () => {
    const introductions = [
      knowledge.profile.title,
      knowledge.profile.summary,
      knowledge.welcome.description,
      JSON.stringify([metadata.title, metadata.description]),
      copy.shareImageAlt,
      overview.intro,
      ...overview.questions.flatMap(({ question, tag, short }) => [question, tag, short ?? '']),
    ];
    for (const text of introductions) expect(text).not.toMatch(/staff/i);
  });
});

// D30: Portuguese was switched on with the bilingual fast path (POR-66).
describe('the published site', () => {
  it('speaks English and Portuguese', () => {
    expect(profile.locales).toEqual(['en', 'pt-BR']);
    expect(publishedLocales(profile.locales, {})).toEqual(['en', 'pt-BR']);
  });
});
