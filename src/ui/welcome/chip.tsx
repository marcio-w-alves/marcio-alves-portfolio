import type { ComponentProps } from 'react';
import { cn } from '../cn';

type ChipProps = Omit<ComponentProps<'button'>, 'type'>;

/** A pill-shaped choice: a topic, or a follow-up question. */
export function Chip({ className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'group inline-flex min-h-8.5 cursor-pointer items-center gap-1.5 px-3 py-1.5 text-left font-sans text-13.5 leading-compact font-normal',
        'rounded-pill border border-border bg-surface text-ink',
        'transition-[border-color,color,background-color] duration-fast ease-standard hover:border-accent hover:text-accent',
        '@max-phone/ma:min-h-11 @max-phone/ma:px-3.5 @max-phone/ma:py-2',
        className,
      )}
      {...props}
    />
  );
}
