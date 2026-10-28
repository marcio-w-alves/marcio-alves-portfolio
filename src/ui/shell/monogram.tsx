import { cn } from '../cn';

const SIZES = {
  default: 'size-9 text-12',
  lg: 'size-11 text-14',
} as const;

interface MonogramProps {
  readonly initials: string;
  readonly size?: keyof typeof SIZES;
}

/** Marcio's mark: solid ink, where the assistant that speaks for him is a hairline. */
export function Monogram({ initials, size = 'default' }: MonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-ink font-display leading-none font-semibold tracking-monogram text-white',
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
}
