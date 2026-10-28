import { describe, expect, it } from 'vitest';
import { createOfferFilter } from './offer-filter';

/** Streams the text the way the model does, a few characters at a time. */
function filtered(
  text: string,
  chunk = 3,
  subjectNames: readonly string[] = [],
): { shown: string; asItArrived: string[] } {
  const filter = createOfferFilter({ subjectNames });
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

  it.each([
    'If you ask about performance, he cut load time by 50%.',
    'If you need more details on Roots, he grew the team from one to four.',
    'Se quiser saber de desempenho, ele reduziu o tempo de carregamento em 50%.',
    'Feel free to check his GitHub, he has 40 repos.',
    'Let me know which project; he worked on 3.',
  ])('keeps a factual sentence that starts like an offer: %j', (answer) => {
    expect(filtered(answer).shown).toBe(answer);
  });

  it.each([
    [
      'He led the Acme migration.\n\nFeel free to ask if you need more information.',
      'He led the Acme migration.',
    ],
    ['He led HRIS. If you have more questions, I would be happy to answer them.', 'He led HRIS.'],
    ['He led HRIS. Let me know if you want more details, and I will share them.', 'He led HRIS.'],
    ['He led HRIS. If you want to know more, ask away!', 'He led HRIS.'],
    [
      'He led HRIS. If you have any other questions about his 10 years of experience, feel free to ask.',
      'He led HRIS.',
    ],
    ['He led HRIS. If you need more details, feel free to ask about his work.', 'He led HRIS.'],
    ['He led HRIS. Let me know if you need more details about his 2022 projects.', 'He led HRIS.'],
  ])('removes a closing offer that carries no fact: %j', (answer, expected) => {
    expect(filtered(answer).shown).toBe(expected);
  });

  it.each([
    'If you need more details, he led the HRIS team.',
    'Se precisar de mais informações, ele liderou a equipe de acessibilidade.',
    'Se quiser mais detalhes, a experiência dela inclui React e Next.js.',
    'If you have any questions, Ada built the payments service.',
    'If you need more information, the team shipped 12 releases.',
  ])('keeps an offer-shaped sentence whose subject is the person: %j', (answer) => {
    expect(filtered(answer, 3, ['Ada']).shown).toBe(answer);
  });

  it.each([
    [
      'Ela trabalhou na Deel. Se tiver outras perguntas, fique à vontade para perguntar.',
      'Ela trabalhou na Deel.',
    ],
    ['Trabajó en Deel. Si tienes otras preguntas, estoy a tu disposición.', 'Trabajó en Deel.'],
    ['Ela trabalhou na Deel. Se quiser saber mais, pergunte!', 'Ela trabalhou na Deel.'],
    ['Trabajó en Deel. Si quieres saber más, pregúntame.', 'Trabajó en Deel.'],
  ])('still removes offers in Portuguese and Spanish: %j', (answer, expected) => {
    expect(filtered(answer).shown).toBe(expected);
  });

  it.each([1, 2, 3, 5, 7, 64])(
    'gives the same output however the stream is split, in chunks of %i',
    (chunk) => {
      expect(
        filtered(
          'If you ask about performance, he cut load time by 50%. Feel free to ask if you need more information.',
          chunk,
        ).shown,
      ).toBe('If you ask about performance, he cut load time by 50%.');
    },
  );

  it('shows nothing for an empty answer', () => {
    expect(filtered('').shown).toBe('');
  });

  it('removes an offer the stream ends on without final punctuation', () => {
    expect(filtered('He led HRIS. Let me know if you want more details').shown).toBe(
      'He led HRIS.',
    );
  });

  it.each([
    'If you ask me, the hardest part was the migration.',
    'If you have questions about scope, the answer is in the README.',
  ])('keeps a sentence that mentions asking without offering anything: %j', (answer) => {
    expect(filtered(answer).shown).toBe(answer);
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
