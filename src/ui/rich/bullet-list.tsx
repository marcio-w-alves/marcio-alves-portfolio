import { cn } from '../cn';

// The design inherits the browser's markers: a list nested in another list gets circles.
const MARKERS = {
  disc: 'list-disc',
  circle: 'list-circle',
} as const;

interface BulletListProps {
  readonly items: readonly string[];
  readonly marker: keyof typeof MARKERS;
}

export function BulletList({ items, marker }: BulletListProps) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-1 pl-4.5 text-14 leading-reading marker:text-ink-faint',
        MARKERS[marker],
      )}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
