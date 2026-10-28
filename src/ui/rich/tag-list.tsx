import { Tag } from '../primitives';

// On an ice panel a tag is a white pill with a hairline; elsewhere it is filled.
const TONES = {
  fill: '',
  outline: 'bg-surface shadow-ring',
} as const;

interface TagListProps {
  readonly tags: readonly string[];
  readonly tone?: keyof typeof TONES;
}

export function TagList({ tags, tone = 'fill' }: TagListProps) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        // A flex container, so the item's line box cannot make it taller than its tag.
        <li key={tag} className="flex">
          <Tag className={TONES[tone]}>{tag}</Tag>
        </li>
      ))}
    </ul>
  );
}
