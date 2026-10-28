import { describe, expect, it } from 'vitest';
import { cruiseFixture, cruiseRepository, violationsOf } from '@/testing/dependency-graph';

// One tree per forbidden edge under ./fixtures, each holding exactly that edge.
const FORBIDDEN_EDGES = [
  {
    fixture: 'ui-to-infrastructure',
    rule: 'ui-is-presentation',
    from: 'src/ui/panel.ts',
    to: 'src/infrastructure/logger.ts',
  },
  {
    fixture: 'ui-to-composition-root',
    rule: 'ui-is-presentation',
    from: 'src/ui/panel.ts',
    to: 'src/composition-root.ts',
  },
  { fixture: 'ui-to-env', rule: 'ui-is-presentation', from: 'src/ui/panel.ts', to: 'src/env.ts' },
  {
    fixture: 'infrastructure-to-app',
    rule: 'infrastructure-is-a-plugin',
    from: 'src/infrastructure/adapter.ts',
    to: 'src/app/page.ts',
  },
  {
    fixture: 'infrastructure-to-ui',
    rule: 'infrastructure-is-a-plugin',
    from: 'src/infrastructure/adapter.ts',
    to: 'src/ui/panel.ts',
  },
  {
    fixture: 'app-to-infrastructure',
    rule: 'app-goes-through-roots',
    from: 'src/app/route.ts',
    to: 'src/infrastructure/adapter.ts',
  },
  {
    fixture: 'core-to-ui',
    rule: 'core-is-innermost',
    from: 'src/core/policy.ts',
    to: 'src/ui/panel.ts',
  },
  {
    fixture: 'knowledge-to-assistant',
    rule: 'knowledge-is-below-assistant',
    from: 'src/core/knowledge/records.ts',
    to: 'src/core/assistant/citation.ts',
  },
  {
    fixture: 'ui-to-testing',
    rule: 'fixtures-only-in-tests',
    from: 'src/ui/panel.ts',
    to: 'src/testing/double.ts',
  },
  {
    fixture: 'src-to-scripts',
    rule: 'src-never-imports-scripts',
    from: 'src/ui/panel.ts',
    to: 'scripts/tool.ts',
  },
] as const;

describe('module boundaries', () => {
  it.each(FORBIDDEN_EDGES)('reports $from → $to as $rule', async ({ fixture, rule, from, to }) => {
    const violations = violationsOf(await cruiseFixture(fixture));

    expect(violations).toEqual([{ rule, from, to }]);
  });

  it('reports nothing for a tree whose every edge points inward', async () => {
    const violations = violationsOf(await cruiseFixture('clean'));

    expect(violations).toEqual([]);
  });

  it('finds no violation in the real tree, the knowledge ↔ assistant cycle included', async () => {
    const violations = violationsOf(await cruiseRepository());

    expect(violations).toEqual([]);
  });
});
