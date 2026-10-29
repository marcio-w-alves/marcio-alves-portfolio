import { describe, expect, it } from 'vitest';
import { compileLocaleCopy } from '@/core/assistant/copy/compile';
import { SCORED_INTENTS } from '@/core/assistant/system1/intents';
import { TECHNOLOGIES } from '@/core/assistant/system1/technologies';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import type { CopyDocuments } from '@/core/assistant/copy/copy-document';
import { localize } from '@/core/knowledge/localize';
import { answerTranscript, transcriptDifferences } from './answer-transcript';
import { exampleCopy } from './copy-documents';
import { withDocument } from './copy-variants';
import { fixtureKnowledge } from './fixture-profile/knowledge';

/** The equivalence oracle is only as good as what it covers and what it notices. */

const compiled = (documents: CopyDocuments) =>
  compileLocaleCopy(documents, { locale: 'en', limits: {}, identity: {} }).answers;

describe('the answer transcript', () => {
  it('covers everything the record contains', () => {
    const knowledge = localize(fixtureKnowledge, 'en');
    const transcript = answerTranscript(compiled(exampleCopy('en')), knowledge);
    const perContext = SCORED_INTENTS.length + knowledge.languages.length;
    const expected =
      perContext * 2 + // every intent, and each language named, with and without the card shown
      4 + // greeting, private information, off purpose, unknown
      2 + // slowed down, with and without suggestions
      knowledge.experience.length +
      knowledge.projects.length +
      TECHNOLOGIES.length +
      1 + // a documented technology beside an undocumented one
      TOPIC_IDS.length +
      2; // the labels and the vocabulary
    expect(Object.keys(transcript)).toHaveLength(expected);
  });

  it('grows with the record: one more role is one more answer', () => {
    const [last] = fixtureKnowledge.experience.slice(-1);
    if (!last) throw new Error('The fixture has no roles.');
    const longer = {
      ...fixtureKnowledge,
      experience: [...fixtureKnowledge.experience, { ...last, id: 'hooli', company: 'Hooli' }],
    };
    const answers = compiled(exampleCopy('en'));
    const before = Object.keys(answerTranscript(answers, localize(fixtureKnowledge, 'en')));
    const after = Object.keys(answerTranscript(answers, localize(longer, 'en')));
    expect(after.filter((key) => !before.includes(key))).toEqual(['answer:company:hooli']);
  });

  it('reports exactly the answer and part where one character changed', () => {
    const knowledge = localize(fixtureKnowledge, 'en');
    const documents = exampleCopy('en');
    const changed = withDocument(documents, 'answers/answers.yaml', (answers) => ({
      ...answers,
      greeting: {
        ...(answers.greeting as object),
        parts: [{ text: 'Hello — I answer about {{profile.name}}!' }],
      },
    }));
    expect(
      transcriptDifferences(
        answerTranscript(compiled(documents), knowledge),
        answerTranscript(compiled(changed), knowledge),
      ),
    ).toEqual(['answer:greeting.parts[0].text']);
  });
});
