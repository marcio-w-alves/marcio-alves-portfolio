import { Tag } from '../primitives';

export function TagList({ tags }: { readonly tags: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        // A flex container, so the item's line box cannot make it taller than its tag.
        <li key={tag} className="flex">
          <Tag>{tag}</Tag>
        </li>
      ))}
    </ul>
  );
}
