import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createOpenAIClient } from './openai-client';
import { createOpenAIEmbeddings } from './openai-embeddings';

const EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const client = createOpenAIClient('test-key');

describe('OpenAI embeddings adapter', () => {
  it('asks for the configured model and dimensions, and returns vectors in input order', async () => {
    let body: unknown;
    server.use(
      http.post(EMBEDDINGS_URL, async ({ request }) => {
        body = await request.json();
        // The API documents results by `index`; deliver them out of order on purpose.
        return HttpResponse.json({
          object: 'list',
          model: 'text-embedding-3-small',
          data: [
            { object: 'embedding', index: 1, embedding: [0, 1] },
            { object: 'embedding', index: 0, embedding: [1, 0] },
          ],
          usage: { prompt_tokens: 4, total_tokens: 4 },
        });
      }),
    );

    const embeddings = createOpenAIEmbeddings({
      client,
      model: 'text-embedding-3-small',
      dimensions: 2,
    });
    const vectors = await embeddings.embed(['first', 'second']);

    expect(body).toMatchObject({
      model: 'text-embedding-3-small',
      dimensions: 2,
      input: ['first', 'second'],
    });
    expect(vectors).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it('surfaces a provider failure instead of returning empty vectors', async () => {
    server.use(
      http.post(EMBEDDINGS_URL, () =>
        HttpResponse.json({ error: { message: 'stubbed: key rejected' } }, { status: 401 }),
      ),
    );
    const embeddings = createOpenAIEmbeddings({
      client,
      model: 'text-embedding-3-small',
      dimensions: 2,
    });
    // The stub's own message: a real 401 from the live API cannot satisfy this.
    await expect(embeddings.embed(['x'])).rejects.toThrow('stubbed: key rejected');
  });
});
