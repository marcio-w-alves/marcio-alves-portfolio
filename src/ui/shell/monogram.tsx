import { cn } from '../cn';

const SIZES = {
  default: 'size-8 rounded-mark text-12',
  lg: 'size-10 rounded-mark-lg text-14',
} as const;

interface MonogramProps {
  readonly initials: string;
  readonly size?: keyof typeof SIZES;
}

/** Marcio's mark: solid, where the assistant that speaks for him is outlined. */
export function Monogram({ initials, size = 'default' }: MonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center bg-accent leading-none font-semibold tracking-monogram text-white',
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
}
