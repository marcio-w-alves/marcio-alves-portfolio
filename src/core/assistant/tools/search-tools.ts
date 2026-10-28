import { z } from 'zod';
import type { AnswerSource } from '../assistant-event';
import type { KnowledgeSearchPort } from '../ports/knowledge-search.port';
import { defineTool, type Tool } from './tool';

const LIMIT = 5;

function distinct(sources: readonly AnswerSource[]): AnswerSource[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
}

export function createSearchTools(search: KnowledgeSearchPort): Tool[] {
  const searchKnowledge = defineTool({
    name: 'searchKnowledge',
    description:
      "Semantic search over Marcio's documented record — his résumé, plus his knowledge-base notes on how he works, system design, AI-assisted engineering, studies, own products, goals and interests — for questions no specific action covers. Returns the matching passages; an empty result means the record does not cover the question.",
    input: {
      query: z.string().trim().min(2).max(300),
    },
    // Neither a category nor a limit is the model's to choose: it guessed both
    // badly, and "what job is he looking for" searched under profile, or with
    // a limit of one, never reached the answer in his notes.
    execute: async ({ query }) => {
      const passages = await search.search({ query, limit: LIMIT });
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
      };
    },
  });
  return [searchKnowledge];
}
