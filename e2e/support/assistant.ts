import type { Page } from '@playwright/test';
import { ui } from './profile';

export function answers(page: Page) {
  return page.getByRole('article', { name: ui.conversation.answer });
}

export function composer(page: Page) {
  return page.getByRole('textbox', { name: ui.composer.label });
}

export function stopButton(page: Page) {
  return page.getByRole('button', { name: ui.composer.stop });
}

export function sendButton(page: Page) {
  return page.getByRole('button', { name: ui.composer.send });
}

/**
 * Holds the next question at the browser until the returned function is
 * called, then lets it through to the real server untouched. A fast-path
 * answer arrives in milliseconds, so this is what makes the in-flight state
 * observable without waiting on a clock.
 */
export async function holdNextAnswer(page: Page): Promise<() => void> {
  const { promise: released, resolve: release } = Promise.withResolvers<undefined>();
  await page.route(
    '**/api/chat',
    async (route) => {
      await released;
      await route.continue();
    },
    { times: 1 },
  );
  return () => {
    release(undefined);
  };
}
