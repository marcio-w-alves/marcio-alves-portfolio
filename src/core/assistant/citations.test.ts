import { describe, expect, it } from 'vitest';
import { citation } from './citations';

describe('citation', () => {
  it('cites a record by the label of the document it comes from', () => {
    expect(citation('principles')).toEqual({
      id: 'principles',
      label: 'Engineering principles',
    });
  });

  it('cites every section of the résumé as the résumé itself', () => {
    expect(citation('resume.toptal')).toEqual({ id: 'resume.toptal', label: 'Resume' });
  });
});
