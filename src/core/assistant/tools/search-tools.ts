import { z } from 'zod';
import { CHUNK_CATEGORIES } from '@/core/knowledge/corpus';
import type { AnswerSource } from '../assistant-event';
import type {
  KnowledgeSearchPort,
  KnowledgeSearchQuery,
  Passage,
} from '../ports/knowledge-search.port';
import { defineTool, type Tool, type ToolFailure, type ToolResult } from './tool';

const DEFAULT_LIMIT = 5;
const SEARCH_KNOWLEDGE = 'searchKnowledge';

function distinct(sources: readonly AnswerSource[]): AnswerSource[] {
  return [...new Map(sources.map((source) => [source.id, source])).values()];
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
  async function find(query: KnowledgeSearchQuery): Promise<Passage[] | null> {
    try {
      return await search.search(query);
    } catch (error) {
      if (query.signal?.aborted) throw error;
      reportError({ tool: SEARCH_KNOWLEDGE, error });
      return null;
    }
  }

  const searchKnowledge = defineTool({
    name: SEARCH_KNOWLEDGE,
    description:
      "Semantic search over Marcio's documented record — his résumé, plus his knowledge-base notes on how he works, system design, AI-assisted engineering, studies, own products, goals and interests — for questions no specific action covers. Returns the matching passages; an empty result means the record does not cover the question.",
    input: {
      query: z.string().trim().min(2).max(300),
      category: z.enum(CHUNK_CATEGORIES).optional(),
      limit: z.number().int().min(1).max(8).optional(),
    },
    execute: async ({ query, category, limit }, signal) => {
      const asked = { query, limit: limit ?? DEFAULT_LIMIT, ...(signal ? { signal } : {}) };
      const inCategory = category ? await find({ ...asked, category }) : [];
      if (!inCategory) return UNAVAILABLE;
      // A category the model guessed is only a preference: "his pets" filed
      // under profile found nothing, while his notes had them.
      const widened = Boolean(category) && inCategory.length === 0;
      const passages = category && !widened ? inCategory : await find(asked);
      if (!passages) return UNAVAILABLE;
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
