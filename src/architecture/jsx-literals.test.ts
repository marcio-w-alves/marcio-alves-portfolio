import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

/** Lints `code` as if it were the given interface file, under the repository's own config. */
async function literalsIn(file: string, code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText(code, { filePath: `${root}${file}` });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'react/jsx-no-literals')
    .map((message) => message.message);
}

describe('text written into the interface markup', () => {
  it('is refused, so a new label goes to the catalog', async () => {
    const planted = 'export function Chip() {\n  return <button>Close the drawer</button>;\n}\n';
    expect(await literalsIn('src/ui/welcome/chip.tsx', planted)).toEqual([
      'Missing JSX expression container around literal string: "Close the drawer"',
    ]);
  });

  it('allows the punctuation that joins catalog messages', async () => {
    const joined = "export function Chip() {\n  return <span>{'a'} · {'b'}…</span>;\n}\n";
    expect(await literalsIn('src/ui/welcome/chip.tsx', joined)).toEqual([]);
  });
}, 60_000);
