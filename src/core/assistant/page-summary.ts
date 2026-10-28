import type { ResponsePart } from './response';

const MAX_TEXT = 700;
const MAX_SUMMARY = 4000;

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function describe(part: ResponsePart): string | null {
  if (part.type === 'text') return clip(part.text, MAX_TEXT);
  switch (part.component) {
    case 'timeline':
      return `Timeline of every role, each with its responsibilities, leadership, results and focus areas: ${part.props.roles
        .map((role) => `${role.company} — ${role.role}, ${role.period}: ${role.summary}`)
        .join('; ')}`;
    case 'skills':
      return `Skills by area: ${part.props.groups
        .map((group) => `${group.title}: ${group.items.join(', ')}`)
        .join('; ')}`;
    case 'projects':
      return `A card per product: ${part.props.projects
        .map((project) => `${project.name} (${project.status}): ${project.description}`)
        .join('; ')}`;
    case 'metrics':
      return `Result cards: ${part.props.items
        .map((item) => `${item.value} ${item.label}${item.context ? ` (${item.context})` : ''}`)
        .join('; ')}`;
    case 'table':
      return `${part.props.caption}: ${part.props.rows.map((row) => row.join(' — ')).join('; ')}`;
    case 'details':
      return clip(`${part.props.summary}: ${part.props.text}`, MAX_TEXT);
    case 'note':
    case 'contact':
      return null;
  }
}

/**
 * What a topic page shows the visitor, in plain words, so the model can
 * answer there without repeating it.
 */
export function summarizePage(parts: readonly ResponsePart[]): string {
  return clip(
    parts
      .map(describe)
      .filter((line): line is string => line !== null)
      .join('\n\n'),
    MAX_SUMMARY,
  );
}
