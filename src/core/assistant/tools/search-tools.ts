import { z } from 'zod';
import type { AnswerSource } from '../assistant-event';
import type { KnowledgeSearchPort, Passage } from '../ports/knowledge-search.port';
import { defineTool, type Tool, type ToolFailure, type ToolResult } from './tool';

const LIMIT = 5;
const SEARCH_KNOWLEDGE = 'searchKnowledge';

const ROLE_PASSAGES = 3;

/**
 * Questions about leading, managing or mentoring people, in the languages
 * visitors write in. "Ele já liderou equipes?" once retrieved the leadership
 * skill list, his education and his certifications above the roles where he
 * led a team, and the answer listed skill names instead of what he did.
 */
const LEADING_WORD =
  /(?<!\p{L})(leaders?|leadership|l[ií]der\p{L}*|mentor\p{L}*|supervis\p{L}*|chefi\p{L}*|gestor(a|as|es)?)(?!\p{L})/iu;
// These also manage state or measure lead time: only about people when people are named.
const MANAGING_WORD =
  /(?<!\p{L})(lead(s|ing)?|led|manag\p{L}*|gerenc\p{L}*|gest[ãa]o|gestion\p{L}*|coorden\p{L}*)(?!\p{L})/iu;
const PEOPLE_WORD =
  /(?<!\p{L})(teams?|people|engineers?|developers?|devs?|juniors?|squads?|staff|reports|pessoas|equipes?|engenheiros|desenvolvedores|personas|equipos?|gente)(?!\p{L})/iu;

function isAboutLeading(query: string): boolean {
  return LEADING_WORD.test(query) || (MANAGING_WORD.test(query) && PEOPLE_WORD.test(query));
}

function distinct(sources: readonly AnswerSource[]): AnswerSource[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

/**
 * The roles' own statements come first. Each one added displaces the weakest
 * résumé passage, never a note: the notes keep the share retrieval gave them.
 */
function rolesFirst(ranked: readonly Passage[], roles: readonly Passage[]): Passage[] {
  const placed = new Set(roles.map((passage) => passage.id));
  const rest = ranked.filter((passage) => !placed.has(passage.id));
  const added = roles.length + rest.length - ranked.length;
  const weakestRecord = rest
    .filter((passage) => passage.category !== 'notes')
    .reverse()
    .slice(0, added);
  const displaced = new Set(weakestRecord.map((passage) => passage.id));
  return [...roles, ...rest.filter((passage) => !displaced.has(passage.id))];
}

function evidenceBySource(passages: readonly Passage[]): Record<string, string> {
  const ids = new Set(passages.map(({ source }) => source.id));
  return Object.fromEntries(
    [...ids].map((id) => [
      id,
      passages
        .filter(({ source }) => source.id === id)
        .map(({ text }) => text)
        .join('\n'),
    ]),
  );
}

export const SEARCH_UNAVAILABLE =
  'Search is unavailable right now; answer only from other actions or decline. Do not answer from general knowledge.';

const UNAVAILABLE: ToolResult = { data: { passages: [], note: SEARCH_UNAVAILABLE }, sources: [] };

/**
 * Retrieval failing — an outage, a timeout, its circuit open — leaves the
 * model without search, not the visitor without an answer.
 */
export function createSearchTools(
  search: KnowledgeSearchPort,
  reportError: (failure: ToolFailure) => void,
): Tool[] {
  async function ranked(query: string, signal?: AbortSignal): Promise<Passage[]> {
    const scope = signal ? { signal } : {};
    const [passages, roles] = await Promise.all([
      search.search({ query, limit: LIMIT, ...scope }),
      isAboutLeading(query)
        ? search.search({ query, limit: LIMIT, category: 'experience', ...scope })
        : [],
    ]);
    return rolesFirst(passages, roles.slice(0, ROLE_PASSAGES));
  }

  async function find(query: string, signal?: AbortSignal): Promise<Passage[] | null> {
    try {
      return await ranked(query, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      reportError({ tool: SEARCH_KNOWLEDGE, error });
      return null;
    }
  }

  const searchKnowledge = defineTool({
    name: SEARCH_KNOWLEDGE,
    description:
      'Semantic search over his documented record — his résumé, plus his knowledge-base notes on how he works, system design, AI-assisted engineering, studies, own products, goals and interests — for questions no specific action covers. Returns the matching passages; an empty result means the record does not cover the question.',
    input: {
      query: z.string().trim().min(2).max(300),
    },
    // Neither a category nor a limit is the model's to choose: it guessed both
    // badly, and "what job is he looking for" searched under profile, or with
    // a limit of one, never reached the answer in his notes.
    execute: async ({ query }, signal) => {
      const passages = await find(query, signal);
      if (!passages) return UNAVAILABLE;
      return {
        data:
          passages.length > 0
            ? {
                passages: passages.map((passage) => ({
                  text: passage.text,
                  category: passage.category,
                  relevance: Math.round(passage.score * 100) / 100,
                })),
              }
            : {
                passages: [],
                note: 'Nothing in the documented record matches. Do not answer from general knowledge.',
              },
        sources: distinct(passages.map((passage) => passage.source)),
        evidence: evidenceBySource(passages),
      };
    },
  });
  return [searchKnowledge];
}
