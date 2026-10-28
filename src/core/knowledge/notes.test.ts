import { describe, expect, it } from 'vitest';
import { parseNotes } from './notes';

describe('knowledge-base notes', () => {
  it('name the section a passage comes from, even when a long subsection is split', () => {
    const markdown = [
      '## 3. Linha do tempo',
      '### 3.1 Acme',
      'a'.repeat(1000),
      '',
      'b'.repeat(1000),
      '## 16. Estrutura de dados',
      'ignored',
    ].join('\n');
    expect(parseNotes(markdown)).toEqual([
      {
        id: '3.1:1',
        text: `Knowledge-base notes — 3. Linha do tempo › 3.1 Acme:\n${'a'.repeat(1000)}`,
      },
      {
        id: '3.1:2',
        text: `Knowledge-base notes — 3. Linha do tempo › 3.1 Acme:\n${'b'.repeat(1000)}`,
      },
    ]);
  });
});
