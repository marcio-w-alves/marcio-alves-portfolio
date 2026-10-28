import { describe, expect, it } from 'vitest';
import type { SitePassage } from '../knowledge/schema';
import { createCitation } from './citations';

const sitePassage: SitePassage = {
  id: 'site/pipewright/0',
  subject: { kind: 'project', id: 'pipewright' },
  url: 'https://www.pipewright.example/about/',
  fetchedAt: '2026-10-28',
  language: 'en',
  text: 'Pipewright runs your pipelines.',
};

const citation = createCitation({
  sourceLabels: { principles: 'Engineering principles', 'resume.acme': 'Resume' },
  productSites: [sitePassage],
});

describe('citation', () => {
  it('cites a record by the label of the document it comes from', () => {
    expect(citation('principles')).toEqual({ id: 'principles', label: 'Engineering principles' });
    expect(citation('resume.acme')).toEqual({ id: 'resume.acme', label: 'Resume' });
  });

  it('cites a page of a product site by where it lives, linking to it', () => {
    expect(citation('site:https://www.pipewright.example/about/')).toEqual({
      id: 'site:https://www.pipewright.example/about/',
      label: 'pipewright.example/about',
      url: 'https://www.pipewright.example/about/',
    });
  });

  it('refuses a source the record does not label, rather than citing it blank', () => {
    expect(() => citation('resume.unknown')).toThrow('Unknown source "resume.unknown".');
    expect(() => citation('site:https://elsewhere.example/')).toThrow(
      'Unknown source "site:https://elsewhere.example/".',
    );
  });
});
