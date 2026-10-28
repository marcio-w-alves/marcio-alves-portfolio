import type { FullConfig } from '@playwright/test';

/**
 * Refuses to run against a server that could call the model: the journeys
 * must never spend tokens, and a model's answer is not the deterministic one
 * they expect.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('playwright.config.ts must set use.baseURL.');
  const response = await fetch(new URL('/api/health', baseURL));
  const health = (await response.json()) as { readonly model?: string };
  if (health.model !== 'disabled') {
    throw new Error(
      `The server under test reports model "${String(health.model)}". Start it without OPENAI_API_KEY.`,
    );
  }
}
