import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SHA = 'fa1eade47b73733d6312d5abfad33ce9e4068081';
const API_KEY = 'sk-test-health-must-never-show-this';

/** A fresh server instance, wired as in production: the environment is read once per instance. */
async function getHealth(): Promise<Response> {
  vi.resetModules();
  const { buildContainer } = await import('@/composition-root');
  const { createHealthHandler } = await import('./health-handler');
  return createHealthHandler(buildContainer())();
}

beforeEach(() => {
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', SHA);
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('RELEASE_VERSION', '');
  vi.stubEnv('GITHUB_TOKEN', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/health', () => {
  it('reports the build and a usable model when the credential is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', API_KEY);
    const response = await getHealth();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      status: 'ok',
      version: null,
      commit: 'fa1eade',
      environment: 'production',
      model: 'enabled',
      circuit: 'closed',
    });
  });

  it('reports the model disabled, and the site still ok, without the credential', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const body: unknown = await (await getHealth()).json();
    expect(body).toMatchObject({ status: 'ok', model: 'disabled', circuit: null });
  });

  it('never reveals the credential itself', async () => {
    vi.stubEnv('OPENAI_API_KEY', API_KEY);
    expect(await (await getHealth()).text()).not.toContain(API_KEY);
  });

  it('names the release when the deployment supplies one', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('RELEASE_VERSION', 'v1.4.0');
    expect(await (await getHealth()).json()).toMatchObject({ version: 'v1.4.0' });
  });

  it('says plainly when it is not a Vercel build', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '');
    vi.stubEnv('VERCEL_ENV', undefined);
    expect(await (await getHealth()).json()).toMatchObject({
      version: null,
      commit: null,
      environment: 'development',
    });
  });
});
