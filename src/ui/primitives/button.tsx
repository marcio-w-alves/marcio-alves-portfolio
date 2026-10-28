import type { ComponentProps } from 'react';
import { cn } from '../cn';

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface text-ink inset-shadow-ring-strong hover:bg-hover',
  ghost: 'bg-transparent text-ink-muted hover:bg-hover hover:text-ink',
} as const;

const SIZES = {
  default: 'h-10 rounded-control px-4 text-14',
  sm: 'h-8 rounded-sm px-3 text-13',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

interface Appearance {
  readonly variant?: ButtonVariant | undefined;
  readonly size?: ButtonSize | undefined;
}

function buttonClasses(
  { variant = 'secondary', size = 'default' }: Appearance,
  className?: string,
) {
  return cn(
    'inline-flex cursor-pointer items-center justify-center gap-2 leading-none font-medium whitespace-nowrap no-underline',
    'transition-[background-color,color,box-shadow,transform] duration-fast ease-standard active:scale-98',
    'disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50',
    'aria-disabled:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = Appearance & ComponentProps<'button'>;

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...props} />;
}

type ButtonLinkProps = Appearance & ComponentProps<'a'> & { readonly href: string };

/** A link that looks like a button: it navigates, so it stays an anchor. */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <a className={buttonClasses({ variant, size }, className)} {...props} />;
}
