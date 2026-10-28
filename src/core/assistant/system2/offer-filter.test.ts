import { describe, expect, it } from 'vitest';
import { createOfferFilter } from './offer-filter';

/** Streams the text the way the model does, a few characters at a time. */
function filtered(text: string, chunk = 3): { shown: string; asItArrived: string[] } {
  const filter = createOfferFilter();
  const asItArrived: string[] = [];
  for (let index = 0; index < text.length; index += chunk) {
    asItArrived.push(filter.push(text.slice(index, index + chunk)));
  }
  asItArrived.push(filter.flush());
  return { shown: asItArrived.join(''), asItArrived };
}

describe('offers of help in a streamed answer', () => {
  it.each([
    [
      'He led the HRIS team at Deel.\n\nIf you need more details about any specific repository, feel free to ask!',
      'He led the HRIS team at Deel.',
    ],
    [
      'Ele liderou a acessibilidade na Toptal.\n\nSe precisar de mais informações sobre suas experiências, estou à disposição.',
      'Ele liderou a acessibilidade na Toptal.',
    ],
    [
      'Trabajó con React en Deel. Si necesitas más información, no dudes en preguntar.',
      'Trabajó con React en Deel.',
    ],
    [
      'It is not documented. If you have other questions about his experience or skills, feel free to ask.',
      'It is not documented.',
    ],
  ])('drops the offer and keeps the answer: %j', (answer, expected) => {
    expect(filtered(answer).shown).toBe(expected);
  });

  it('drops an offer in the middle of an answer without merging the paragraphs around it', () => {
    expect(
      filtered('He led HRIS.\n\nLet me know if you want more.\n\n### Roots\nHe grew the team.')
        .shown,
    ).toBe('He led HRIS.\n\n### Roots\nHe grew the team.');
  });

  it('keeps a sentence that only starts like an offer', () => {
    const answer =
      'If you want to reach him, his email is marcio@example.com. If there is one theme, it is performance.';
    expect(filtered(answer).shown).toBe(answer);
  });

  it('keeps an answer with no offer exactly as written, lists and headings included', () => {
    const answer =
      '### Deel\n- Improved web vitals by 30%.\n- Cut load time from 6s to 3s.\n\nHe asks questions early, e.g. in planning.';
    expect(filtered(answer, 1).shown).toBe(answer);
  });

  it('shows ordinary text as it arrives instead of waiting for the sentence to end', () => {
    const { asItArrived } = filtered('Marcio worked at Deel from 2022 to 2026.', 5);
    expect(asItArrived[1]).toBe('o wor');
  });
});
