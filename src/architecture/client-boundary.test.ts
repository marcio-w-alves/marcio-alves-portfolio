import { describe, expect, it } from 'vitest';
import { clientPathsTo, cruiseFixture, cruiseRepository } from '@/testing/dependency-graph';

// The font loaders are the one part of the profile safe in the browser: the global error page uses them.
// The knowledge base, the assistant engine and the page builders hold the record, so they stay on the server too.
const isServerOnly = (source: string) =>
  /^src\/(infrastructure\/|http\/|site\/|core\/(knowledge|assistant)\/|profile\/(?!fonts\.ts$)|composition-root\.|site-root\.|env\.)/.test(
    source,
  );

describe('the client bundle boundary', () => {
  it('finds a client module that reaches the composition root through a helper, and only that one', async () => {
    const paths = clientPathsTo(await cruiseFixture('client-reaches-server'), isServerOnly);

    expect(paths).toEqual([['src/app/widget.ts', 'src/app/label.ts', 'src/composition-root.ts']]);
  });

  it('finds a client module that pulls the knowledge base in through a helper, but not one that only names an engine type beside a contract', async () => {
    const paths = clientPathsTo(await cruiseFixture('client-reaches-knowledge'), isServerOnly);

    expect(paths).toEqual([
      ['src/ui/timeline.tsx', 'src/ui/record.ts', 'src/core/knowledge/corpus.ts'],
    ]);
  });

  it('has no client module in the real tree that reaches the record, the engine, the page builders, a root, env, an adapter, an API handler or the profile', async () => {
    const paths = clientPathsTo(await cruiseRepository(), isServerOnly);

    expect(paths).toEqual([]);
  });
});
