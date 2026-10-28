'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../cn';
import { useMessages } from '../i18n/i18n-provider';
import { IconButton } from '../primitives';

interface AppShellProps {
  readonly profile: { readonly name: string };
  /** The sidebar. In the compact layout it becomes a drawer over the conversation. */
  readonly navigation: ReactNode;
  readonly drawerOpen: boolean;
  readonly onDrawerOpenChange: (open: boolean) => void;
  readonly onNewConversation: () => void;
  readonly children: ReactNode;
}

const NAVIGATION_ID = 'portfolio-navigation';
const MAIN_ID = 'conversation';
// Mirrors --container-compact: at this width and above there is no drawer.
const COMPACT_BELOW_PX = 861;

/**
 * The page frame: sidebar and main column side by side, or — below 860px of
 * the app's own width — a top bar whose menu opens the sidebar as a drawer.
 *
 * While the drawer is open the rest of the page is `inert`, which is the focus
 * trap: nothing behind the scrim can be reached by Tab, pointer or a screen
 * reader. Escape, the scrim and the close button dismiss it, and focus goes
 * back to the menu button that opened it.
 */
export function AppShell({
  profile,
  navigation,
  drawerOpen,
  onDrawerOpenChange,
  onNewConversation,
  children,
}: AppShellProps) {
  const { shell } = useMessages();
  const rootRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(drawerOpen);

  useEffect(() => {
    if (drawerOpen === wasOpen.current) return;
    wasOpen.current = drawerOpen;
    if (drawerOpen) {
      navigationRef.current?.querySelector<HTMLElement>('nav a')?.focus();
    } else if (navigationRef.current?.contains(document.activeElement)) {
      menuButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  // A drawer left open when the window widens would keep the page inert
  // behind a sidebar that is no longer a drawer.
  useEffect(() => {
    const root = rootRef.current;
    if (!drawerOpen || !root) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width >= COMPACT_BELOW_PX) onDrawerOpenChange(false);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
    };
  }, [drawerOpen, onDrawerOpenChange]);

  const close = () => {
    onDrawerOpenChange(false);
  };

  return (
    <div
      ref={rootRef}
      className="@container/ma relative h-dvh overflow-hidden bg-bg font-sans text-ink"
    >
      {/* The first stop for a keyboard: past the topics, straight to the conversation. */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-3 focus-visible:z-40 focus-visible:rounded-control focus-visible:bg-surface focus-visible:px-3 focus-visible:py-2 focus-visible:text-13.5 focus-visible:font-medium focus-visible:text-ink focus-visible:shadow-ring"
      >
        {shell.skipToConversation}
      </a>
      <div className="grid h-full grid-cols-shell @max-compact/ma:grid-cols-1">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={close}
          className={cn(
            'hidden @max-compact/ma:absolute @max-compact/ma:inset-0 @max-compact/ma:z-20 @max-compact/ma:block',
            'bg-ink/18 p-0 transition-opacity duration-medium ease-standard',
            drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />
        <div
          ref={navigationRef}
          id={NAVIGATION_ID}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && drawerOpen) close();
          }}
          className={cn(
            'min-h-0 bg-ice inset-shadow-rule-right',
            '@max-compact/ma:absolute @max-compact/ma:inset-y-0 @max-compact/ma:left-0 @max-compact/ma:z-30',
            '@max-compact/ma:w-drawer @max-compact/ma:inset-shadow-none',
            '@max-compact/ma:duration-medium @max-compact/ma:ease-standard',
            // Visibility flips at once on opening, so focus can move in; on
            // closing it waits for the slide to finish.
            drawerOpen
              ? '@max-compact/ma:shadow-drawer @max-compact/ma:transition-[translate]'
              : '@max-compact/ma:invisible @max-compact/ma:-translate-x-full @max-compact/ma:transition-[translate,visibility]',
          )}
        >
          {navigation}
        </div>

        <main
          id={MAIN_ID}
          tabIndex={-1}
          inert={drawerOpen}
          className="relative flex min-h-0 min-w-0 flex-col bg-bg outline-none"
        >
          <header className="hidden h-14 shrink-0 items-center gap-1 bg-bg px-1.5 inset-shadow-rule-bottom @max-compact/ma:flex">
            <IconButton
              ref={menuButtonRef}
              icon="menu"
              label={shell.openNavigation}
              size="touch"
              aria-controls={NAVIGATION_ID}
              aria-expanded={drawerOpen}
              onClick={() => {
                onDrawerOpenChange(true);
              }}
            />
            <p className="min-w-0 flex-1 text-center font-display text-15 leading-none font-semibold tracking-identity">
              {profile.name}
            </p>
            <IconButton
              icon="compose"
              label={shell.newConversation}
              size="touch"
              onClick={onNewConversation}
            />
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
