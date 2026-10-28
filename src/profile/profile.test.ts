import { describe, expect, it } from 'vitest';
import { createResponseKit } from '@/core/assistant/response-kit';
import { localize } from '@/core/knowledge/localize';
import { profile } from '.';

/**
 * The only tests that name the owner: what this particular record says.
 * Everything a record must satisfy in general is checked by its validation.
 */

const knowledge = localize(profile.knowledge, 'en');

describe("the owner's record", () => {
  it('has Toptal as the one current role', () => {
    const current = knowledge.experience.filter((role) => role.current);
    expect(current.map((role) => role.company)).toEqual(['Toptal']);
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

  it('marks the roles held alongside another as concurrent, and only those', () => {
    const { timeline } = createResponseKit(knowledge);
    const block = timeline();
    if (block.component !== 'timeline') throw new Error('timeline() built another block.');
    const concurrent = block.props.roles.filter((role) => role.concurrent).map((role) => role.id);
    expect(concurrent).toEqual(['roots', 'maison', 'webfi', 'freelance']);
  });

  it('names the owner the way the identity does, in one place', () => {
    expect(knowledge.profile.name).toBe(profile.identity.name);
    expect(knowledge.contact.github).toBe(profile.identity.contact.github);
  });
});
