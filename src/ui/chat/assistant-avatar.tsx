import { cn } from '../cn';

/** The assistant's mark: outlined, where Marcio's own monogram is solid. */
export function AssistantAvatar({ inline = false }: { readonly inline?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-surface font-mono leading-none font-semibold tracking-avatar text-accent inset-shadow-ring',
        inline ? 'size-5.5 text-8.5' : 'size-7 text-10',
      )}
    >
      MA
    </span>
  );
}
