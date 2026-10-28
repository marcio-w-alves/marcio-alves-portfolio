import { cn } from '../cn';

/** The assistant's mark: a hairline, where Marcio's own monogram is solid ink. */
export function AssistantAvatar({ inline = false }: { readonly inline?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface font-display leading-none font-semibold tracking-avatar text-ink shadow-ring-strong',
        inline ? 'size-5.5 text-8.5' : 'size-7 text-9.5',
      )}
    >
      MA
    </span>
  );
}
