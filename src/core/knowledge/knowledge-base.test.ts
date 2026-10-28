import { describe, expect, it } from 'vitest';
import { METRIC_IDS, PROJECT_IDS, ROLE_IDS } from './ids';
import { isConcurrent, knowledgeBase, projectById, roleById } from './knowledge-base';

describe('knowledge base', () => {
  it('has exactly one role for every role id', () => {
    const ids = knowledgeBase.experience.map((role) => role.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect([...ids].sort()).toEqual([...ROLE_IDS].sort());
  });

  it('has exactly one project for every project id', () => {
    const ids = knowledgeBase.projects.map((project) => project.id);
    expect(ids).toHaveLength(new Set(ids).size);
    expect([...ids].sort()).toEqual([...PROJECT_IDS].sort());
  });

  it('resolves every role and project by id', () => {
    for (const id of ROLE_IDS) expect(roleById(id).id).toBe(id);
    for (const id of PROJECT_IDS) expect(projectById(id).id).toBe(id);
  });

  it('lists experience newest first', () => {
    const starts = knowledgeBase.experience.map((role) => role.start);
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
  });

  it('marks only the role without an end date as current', () => {
    const current = knowledgeBase.experience.filter((role) => role.current);
    expect(current.map((role) => role.id)).toEqual(['toptal']);
    expect(current.every((role) => role.end === null)).toBe(true);
  });

  it('cites each role against its own resume section', () => {
    for (const role of knowledgeBase.experience) expect(role.source).toBe(`resume.${role.id}`);
  });

  it('keeps every metric with the company that produced it', () => {
    for (const role of knowledgeBase.experience) {
      for (const id of role.metrics) expect(knowledgeBase.metrics[id].context).toBe(role.company);
    }
  });

  it('attributes every metric to exactly one role', () => {
    const cited = knowledgeBase.experience.flatMap((role) => role.metrics);
    expect(cited).toHaveLength(new Set(cited).size);
    expect([...cited].sort()).toEqual([...METRIC_IDS].sort());
  });

  it('keeps the verbatim resume record for every role', () => {
    for (const role of knowledgeBase.experience) expect(role.highlights.length).toBeGreaterThan(0);
  });

  it('states the city Marcio confirmed (POR-40), not one guessed from context', () => {
    expect(knowledgeBase.profile.location.city).toBe('João Pessoa, Paraíba');
  });
});

describe('isConcurrent', () => {
  it('detects roles held at the same time', () => {
    expect(isConcurrent(roleById('roots'))).toBe(true);
    expect(isConcurrent(roleById('maison'))).toBe(true);
    expect(isConcurrent(roleById('webfi'))).toBe(true);
  });

  it('treats a role that ends as another begins as sequential, not concurrent', () => {
    expect(isConcurrent(roleById('toptal'))).toBe(false);
    expect(isConcurrent(roleById('shall'))).toBe(false);
  });
});
