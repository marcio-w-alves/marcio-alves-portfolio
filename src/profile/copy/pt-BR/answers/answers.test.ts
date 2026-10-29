import { describe, expect, it } from 'vitest';
import type { AssistantResponse } from '@/core/assistant/response';
import { createResponseKit } from '@/core/assistant/response-kit';
import type { ConversationContext } from '@/core/chat/request';
import { localize } from '@/core/knowledge/localize';
import { withMetric } from '@/testing/fixture-profile/variants';
import { answers } from '.';
import { knowledge as source } from '../../../knowledge';

/** What this profile's Portuguese answers say, checked against its own record. */

const FRESH: ConversationContext = { topic: 'overview', lastIntent: null, ctaShown: false };

function answersOver(record = source) {
  return answers.answers(createResponseKit(localize(record, 'pt-BR'), answers.labels));
}

function plainText(response: AssistantResponse): string {
  return response.parts
    .map((part) => (part.type === 'text' ? part.text : JSON.stringify(part.props)))
    .join('\n');
}

describe('the Portuguese answers', () => {
  it("name the award as the record's Portuguese achievements write it", () => {
    const text = plainText(answersOver().scored.awards(FRESH, ''));
    expect(text).toContain('**Golden Award em 2019**');
    expect(text).toContain('O Golden Award foi para o produto em que ele trabalhou');
  });

  it('say how long the career has been, in Portuguese, from the record', () => {
    expect(plainText(answersOver().scored.career(FRESH, ''))).toContain(
      'com **mais de 10 anos** de experiência profissional',
    );
  });

  it('write counts from the record as Portuguese words', () => {
    const text = plainText(answersOver().company('deel'));
    expect(text).toContain('passou de seis segundos para três sem cache');
  });

  it('follow a change to the record instead of repeating a figure written in code', () => {
    const changed = withMetric(source, 'deel-people-list', { value: '8s → 2s' });
    expect(plainText(answersOver(changed).company('deel'))).toContain(
      'passou de oito segundos para dois sem cache',
    );
  });

  it('recognize a language asked about by its Portuguese name, accent and all', () => {
    const { languages } = answersOver().scored;
    expect(plainText(languages(FRESH, 'Ele fala inglês?'))).toContain(
      'Sim — Inglês em nível fluente.',
    );
    expect(plainText(languages(FRESH, 'E português?'))).toContain(
      'Português é a língua nativa dele.',
    );
  });

  it('show the levels of the languages in Portuguese', () => {
    const table = answersOver()
      .scored.languages(FRESH, '')
      .parts.find((part) => part.type === 'component' && part.component === 'table');
    expect(JSON.stringify(table)).toContain('["Inglês","Fluente"]');
  });
});
