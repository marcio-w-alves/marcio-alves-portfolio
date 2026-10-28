import { Icon } from '../primitives';

/** Scrolls the conversation back to its newest message; the dock positions it. */
export function JumpToLatest({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-full left-1/2 z-2 mb-2 inline-flex h-8.5 -translate-x-1/2 animate-rise-short cursor-pointer items-center justify-center gap-1.5 rounded-pill border-0 bg-surface px-3.5 font-sans text-12.5 leading-none font-medium whitespace-nowrap text-ink shadow-float transition-[background-color,color,box-shadow,scale] duration-fast ease-standard active:scale-98"
    >
      <Icon name="arrowDown" size="sm" />
      Jump to latest
    </button>
  );
}
