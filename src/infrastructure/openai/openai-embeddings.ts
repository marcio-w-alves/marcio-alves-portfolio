import type OpenAI from 'openai';
import type { EmbeddingPort } from '@/core/assistant/ports/embedding.port';

interface Options {
  readonly client: OpenAI;
  readonly model: string;
  readonly dimensions: number;
}

export function createOpenAIEmbeddings({ client, model, dimensions }: Options): EmbeddingPort {
  return {
    async embed(texts) {
      const response = await client.embeddings.create({ model, input: [...texts], dimensions });
      // The API documents results by `index`, not by position; order them explicitly.
      return [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
    },
  };
}
