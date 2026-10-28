import type { RichComponent } from '../chat/components';
import type { MessagePart } from './messages';

/**
 * An answer as plain text — what "Copy answer" puts on the clipboard and what
 * the server is told of earlier turns. Blocks become short readable lines.
 */

export function stripInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1 ($2)');
}

function describe(block: RichComponent): string {
  switch (block.component) {
    case 'metrics':
      return block.props.items
        .map(
          (metric) =>
            `• ${metric.value} — ${metric.label}${metric.context ? ` (${metric.context})` : ''}`,
        )
        .join('\n');
    case 'timeline':
      return block.props.roles
        .map((role) => `• ${role.period} · ${role.company} · ${role.role}`)
        .join('\n');
    case 'skills':
      return block.props.groups
        .map((group) => `${group.title}: ${group.items.join(', ')}`)
        .join('\n');
    case 'projects':
      return block.props.projects
        .map((project) => `• ${project.name} — ${project.description}`)
        .join('\n');
    case 'table':
      return [block.props.columns, ...block.props.rows].map((row) => row.join(' | ')).join('\n');
    case 'note':
      return stripInline(block.props.text);
    case 'details':
      return `${block.props.summary}\n${stripInline(block.props.text)}`;
    case 'contact':
      return `Email: ${block.props.email}\nLinkedIn: ${block.props.linkedin}`;
  }
}

export function toPlainText(parts: readonly MessagePart[]): string {
  return parts
    .map((part) => {
      if (part.type === 'text') return stripInline(part.text);
      const { type: _part, id: _id, ...block } = part;
      return describe(block);
    })
    .filter(Boolean)
    .join('\n\n');
}
