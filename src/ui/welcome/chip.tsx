import type { ComponentProps } from 'react';
import { cn } from '../cn';

type ChipProps = Omit<ComponentProps<'button'>, 'type'>;

/** A pill-shaped choice, such as a suggested question. */
export function Chip({ className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'group inline-flex min-h-8.5 cursor-pointer items-center gap-2 px-3.5 py-1.75 text-left font-sans text-13 leading-compact font-normal',
        'rounded-pill border-0 bg-surface text-ink-muted shadow-ring-strong',
        'transition-[box-shadow,color,background-color] duration-fast ease-standard hover:bg-ice hover:text-ink hover:shadow-ring-hover',
        '@max-phone/ma:min-h-11 @max-phone/ma:px-4 @max-phone/ma:py-2.5',
        className,
      )}
      {...props}
    />
  );
}
