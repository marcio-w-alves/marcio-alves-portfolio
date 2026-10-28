import { describe, expect, it } from 'vitest';
import { createCitation } from './citations';

const citation = createCitation({ principles: 'Engineering principles', 'resume.acme': 'Resume' });

describe('citation', () => {
  it('cites a record by the label of the document it comes from', () => {
    expect(citation('principles')).toEqual({ id: 'principles', label: 'Engineering principles' });
    expect(citation('resume.acme')).toEqual({ id: 'resume.acme', label: 'Resume' });
  });

  it('refuses a source the record does not label, rather than citing it blank', () => {
    expect(() => citation('resume.unknown')).toThrow('Unknown source "resume.unknown".');
  });
});
