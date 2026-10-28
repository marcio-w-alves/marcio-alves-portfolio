import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseNotes } from '@/core/knowledge/notes';
import committed from './notes.json';

const document = readFileSync(new URL('./knowledge-base.md', import.meta.url), 'utf8');
const notes = parseNotes(document);

describe('knowledge-base notes', () => {
  it('are committed as the document is now (run `pnpm notes:build` after editing it)', () => {
    expect(committed).toEqual(notes);
  });

  it('give every question of the FAQ its own passage, question and answer together', () => {
    const questions = document.match(/^\*\*P: /gm) ?? [];
    const faq = notes.filter((note) => note.id.startsWith('14.q'));
    expect(faq).toHaveLength(questions.length);
    expect(faq[0]?.text).toMatch(/\*\*P: Quem é Marcio Alves\?\*\*\nR: /);
  });

  it('leave out the sections about the document itself', () => {
    const everything = notes.map((note) => note.text).join('\n');
    expect(everything).not.toContain('Estrutura de dados para busca semântica');
    expect(everything).not.toContain('Política de resposta');
    expect(everything).not.toContain('Informações importantes a validar');
  });

  it('keep the evidence tags, so the assistant can tell a reported fact from the résumé', () => {
    const deel = notes
      .filter((note) => note.id.startsWith('3.2'))
      .map((note) => note.text)
      .join('\n');
    expect(deel).toContain('[CV-2026]');
    expect(deel).toContain('[RELATO]');
  });
});
