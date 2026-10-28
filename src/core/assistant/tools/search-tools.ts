import { z } from 'zod';
import { CHUNK_CATEGORIES } from '@/core/knowledge/corpus';
import type { AnswerSource } from '../assistant-event';
import type { KnowledgeSearchPort } from '../ports/knowledge-search.port';
import { defineTool, type Tool } from './tool';

const DEFAULT_LIMIT = 5;

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
      category: z.enum(CHUNK_CATEGORIES).optional(),
      limit: z.number().int().min(1).max(8).optional(),
    },
    execute: async ({ query, category, limit }) => {
      const asked = { query, limit: limit ?? DEFAULT_LIMIT };
      const inCategory = category ? await search.search({ ...asked, category }) : [];
      // A category the model guessed is only a preference: "his pets" filed
      // under profile found nothing, while his notes had them.
      const widened = Boolean(category) && inCategory.length === 0;
      const passages = category && !widened ? inCategory : await search.search(asked);
      return {
        data:
          passages.length > 0
            ? {
                ...(widened
                  ? {
                      note: `Nothing under "${String(category)}"; these come from his whole record.`,
                    }
                  : {}),
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
