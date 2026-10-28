import type { ComponentProps } from 'react';
import { cn } from '../cn';
import { Icon, type IconName } from './icon';

const SIZES = {
  // 32px where a mouse points, as designed; a touch screen gets the 44px target.
  default: 'size-8 rounded-sm pointer-coarse:size-11 pointer-coarse:rounded-control',
  touch: 'size-11 rounded-control',
} as const;

type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  readonly icon: IconName;
  /** An icon alone says nothing to a screen reader; the label is the control's name. */
  readonly label: string;
  readonly size?: keyof typeof SIZES;
};

export function IconButton({
  icon,
  label,
  size = 'default',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-grid shrink-0 cursor-pointer place-items-center bg-transparent p-0 text-ink-muted',
        'transition-[background-color,color,scale] duration-fast ease-standard hover:bg-hover hover:text-ink active:scale-94',
        'disabled:cursor-not-allowed disabled:opacity-50',
        SIZES[size],
        className,
      )}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
