import type { Note } from './schema';

/**
 * Turns the owner's knowledge-base document into passages for retrieval.
 *
 * The document is written for people and for an assistant alike: one passage
 * per subsection, one per question in its FAQ, and long subsections split at
 * paragraph breaks so a match stays precise. Each passage repeats its section
 * titles, so it still says what it is about on its own. Its last sections are
 * notes about the document itself (search layout, answer policy, pending
 * checks) and are left out: they describe the record, they are not part of it.
 */

const LAST_SECTION = 15;
const FAQ_SECTION = 14;
const MAX_PASSAGE = 1800;

interface Block {
  readonly id: string;
  readonly heading: string;
  readonly lines: string[];
}

function sectionNumber(title: string): number | null {
  const match = /^(\d+)\./.exec(title);
  return match ? Number(match[1]) : null;
}

function subsectionId(title: string, fallback: string): string {
  return /^(\d+\.\d+)\s/.exec(title)?.[1] ?? fallback;
}

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function withoutFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, '');
}

function blocks(markdown: string): Block[] {
  const found: Block[] = [];
  let section: { number: number; title: string } | null = null;
  let current: Block | null = null;
  let questions = 0;

  for (const line of withoutFrontmatter(markdown).split('\n')) {
    const h2 = /^## (.+)$/.exec(line);
    const h3 = /^### (.+)$/.exec(line);
    if (h2?.[1]) {
      const number = sectionNumber(h2[1]);
      section = number === null || number > LAST_SECTION ? null : { number, title: h2[1] };
      current = section ? { id: String(section.number), heading: section.title, lines: [] } : null;
      if (current) found.push(current);
      continue;
    }
    if (!section) continue;
    if (h3?.[1]) {
      current = {
        id: subsectionId(h3[1], `${String(section.number)}-${slug(h3[1])}`),
        heading: `${section.title} › ${h3[1]}`,
        lines: [],
      };
      found.push(current);
      continue;
    }
    if (section.number === FAQ_SECTION && line.startsWith('**P:')) {
      questions += 1;
      current = {
        id: `${String(FAQ_SECTION)}.q${String(questions)}`,
        heading: section.title,
        lines: [],
      };
      found.push(current);
    }
    current?.lines.push(line);
  }
  return found;
}

function paragraphs(lines: readonly string[]): string[] {
  return lines
    .join('\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/ {2}\n/g, '\n').trim())
    .filter((paragraph) => paragraph.length > 0);
}

function parts(body: readonly string[]): string[] {
  const grouped: string[] = [];
  let part = '';
  for (const paragraph of body) {
    if (part && part.length + paragraph.length > MAX_PASSAGE) {
      grouped.push(part);
      part = '';
    }
    part = part ? `${part}\n\n${paragraph}` : paragraph;
  }
  if (part) grouped.push(part);
  return grouped;
}

export function parseNotes(markdown: string): Note[] {
  return blocks(markdown).flatMap((block) => {
    const split = parts(paragraphs(block.lines));
    return split.map((text, index): Note => ({
      id: split.length > 1 ? `${block.id}:${String(index + 1)}` : block.id,
      text: `Knowledge-base notes — ${block.heading}:\n${text}`,
    }));
  });
}
