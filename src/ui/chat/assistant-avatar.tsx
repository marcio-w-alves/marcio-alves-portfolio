import { cn } from '../cn';

// The line height follows the size: tailwind-merge drops a leading set before a font size.
const SIZES = {
  default: 'size-7 text-9.5 leading-none',
  inline: 'size-5.5 text-8 leading-none',
} as const;

interface AssistantAvatarProps {
  readonly initials: string;
  readonly inline?: boolean;
}

/** The assistant's mark: a hairline, where the owner's own monogram is solid ink. */
export function AssistantAvatar({ initials, inline = false }: AssistantAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface font-display font-semibold tracking-avatar text-ink shadow-ring-strong',
        SIZES[inline ? 'inline' : 'default'],
      )}
    >
      {initials}
    </span>
  );
}
