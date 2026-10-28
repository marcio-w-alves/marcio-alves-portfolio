import { describe, expect, it } from 'vitest';
import { clientPathsTo, cruiseFixture, cruiseRepository } from '@/testing/dependency-graph';

const isServerOnly = (source: string) =>
  /^src\/(infrastructure\/|composition-root\.|env\.)/.test(source);

describe('the client bundle boundary', () => {
  it('finds a client module that reaches the composition root through a helper, and only that one', async () => {
    const paths = clientPathsTo(await cruiseFixture('client-reaches-server'), isServerOnly);

    expect(paths).toEqual([['src/app/widget.ts', 'src/app/label.ts', 'src/composition-root.ts']]);
  });

  it('has no client module in the real tree that reaches a root, env or an adapter', async () => {
    const paths = clientPathsTo(await cruiseRepository(), isServerOnly);

    expect(paths).toEqual([]);
  });
});
