/**
 * Splits the knowledge-base document into the committed passages file.
 *
 * The document is the source; the JSON is what the app imports, because a
 * Markdown file is not a module the build or the serverless bundle can read.
 * A test fails if the two drift apart. `pnpm rag:build` runs this first.
 *
 *   pnpm notes:build
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseNotes } from '../src/core/knowledge/notes';

const SOURCE = new URL('../src/core/knowledge/data/knowledge-base.md', import.meta.url);
const OUTPUT = new URL('../src/core/knowledge/data/notes.json', import.meta.url);

const notes = parseNotes(await readFile(SOURCE, 'utf8'));
await writeFile(OUTPUT, `${JSON.stringify(notes, null, 1)}\n`);
console.log(`Wrote ${String(notes.length)} passages → ${OUTPUT.pathname}`);
