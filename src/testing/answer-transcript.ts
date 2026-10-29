import type { AnswerSet } from '@/core/assistant/answer-set';
import { SUGGESTED, answerCases } from '@/core/assistant/copy/answer-cases';
import { createResponseKit } from '@/core/assistant/response-kit';
import { TOPIC_IDS } from '@/core/chat/topic-id';
import type { Knowledge } from '@/core/knowledge/schema';

/**
 * Everything an answer set says over a record, as plain JSON: every answer
 * for every input (`answerCases`), every topic page, the cards' labels and
 * the router vocabulary. Two answer sets that say the same thing produce
 * equal transcripts, byte for byte in every string.
 */

export type Transcript = Readonly<Record<string, unknown>>;

function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

export function answerTranscript(answerSet: AnswerSet, knowledge: Knowledge): Transcript {
  const kit = createResponseKit(knowledge, answerSet.labels);
  const answers = answerSet.answers(kit);
  const topics = answerSet.topics(kit);
  return {
    ...Object.fromEntries(
      answerCases(knowledge).map((entry) => [`answer:${entry.key}`, plain(entry.respond(answers))]),
    ),
    ...Object.fromEntries(TOPIC_IDS.map((topic) => [`topic:${topic}`, plain(topics[topic])])),
    labels: plain(answerSet.labels),
    vocabulary: Object.fromEntries(
      Object.entries(answerSet.vocabulary).map(([intent, rules]) => [
        intent,
        rules.map(([pattern, weight]) => [pattern.source, pattern.flags, weight]),
      ]),
    ),
  };
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function step(path: string, key: string, inArray: boolean): string {
  if (inArray) return `${path}[${key}]`;
  return path ? `${path}.${key}` : key;
}

/** Where two transcripts differ, as paths: `answer:company:acme.parts[0].text`. */
export function transcriptDifferences(expected: unknown, actual: unknown, path = ''): string[] {
  if (
    !isObject(expected) ||
    !isObject(actual) ||
    Array.isArray(expected) !== Array.isArray(actual)
  ) {
    return Object.is(expected, actual) ? [] : [path || '(root)'];
  }
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
  const inArray = Array.isArray(expected);
  return keys.flatMap((key) =>
    transcriptDifferences(expected[key], actual[key], step(path, key, inArray)),
  );
}

/**
 * Every question a transcript offers a visitor: the follow-ups of each answer
 * and the questions each topic page suggests, without repeats. They are what
 * a profile promises the fast path can answer, which is why the tests ask
 * them all. The follow-ups handed to a slowed-down visitor are the caller's,
 * not the copy's, so they are left out.
 */
export function suggestedQuestions(transcript: Transcript): string[] {
  const given = new Set<string>(SUGGESTED);
  return [
    ...new Set(
      Object.values(transcript).flatMap((entry) => {
        const { followUps = [], questions = [] } = (entry ?? {}) as {
          followUps?: readonly string[];
          questions?: readonly { question: string }[];
        };
        return [...followUps, ...questions.map(({ question }) => question)];
      }),
    ),
  ].filter((question) => !given.has(question));
}
