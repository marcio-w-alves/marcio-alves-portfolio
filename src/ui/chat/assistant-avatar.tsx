import { cn } from '../cn';

// The line height follows the size: tailwind-merge drops a leading set before a font size.
const SIZES = {
  default: 'size-7 text-9.5 leading-none',
  inline: 'size-5.5 text-8 leading-none',
} as const;

/** The assistant's mark: a hairline, where Marcio's own monogram is solid ink. */
export function AssistantAvatar({ inline = false }: { readonly inline?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface font-display font-semibold tracking-avatar text-ink shadow-ring-strong',
        SIZES[inline ? 'inline' : 'default'],
      )}
    >
      MA
    </span>
  );
}
