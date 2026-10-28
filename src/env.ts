import { z } from 'zod';

/**
 * Server secrets, validated once at the system boundary.
 *
 * Resolved lazily so a build never fails for lack of runtime secrets. Both
 * are optional: without the model credential the assistant degrades to the
 * fast path instead of failing.
 */
// `KEY=` in an env file means "not set", not "set to nothing".
const optionalSecret = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  OPENAI_API_KEY: optionalSecret,
  GITHUB_TOKEN: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

/**
 * The site's canonical origin. Kept apart from the secrets above because page
 * metadata needs it at build time, and the build must never need a secret.
 *
 * An explicit SITE_URL wins. Otherwise Vercel's production domain is used: it
 * is injected into every build, previews included, so a deployment can never
 * advertise localhost or a preview URL as its canonical address. The value is
 * read at build time and the home page is prerendered, so attaching a new
 * custom domain only takes effect from the next deployment.
 */
export function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  if (explicit) return new URL(z.url().parse(explicit));

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return new URL(`https://${production}`);

  return new URL('http://localhost:3000');
}

function nonEmpty(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

export interface Deployment {
  /** The release tag, when whoever deployed the build supplied one. */
  readonly version: string | null;
  /** The commit this deployment was built from, abbreviated as git does. */
  readonly commit: string | null;
  readonly environment: string;
}

/**
 * Which build is running, from what the platform injects.
 *
 * The commit is the reliable identity: Vercel sets VERCEL_GIT_COMMIT_SHA on
 * every git deployment. The release tag is not something it can know —
 * semantic-release cuts it in CI once the gates pass, while Vercel is already
 * building that same commit, and Vercel exposes no tag variable anyway. So
 * `version` is RELEASE_VERSION when a deployment sets it, and null otherwise;
 * the tag for a commit is on the repository's Releases page.
 */
export function deployment(): Deployment {
  return {
    version: nonEmpty(process.env.RELEASE_VERSION),
    commit: nonEmpty(process.env.VERCEL_GIT_COMMIT_SHA)?.slice(0, 7) ?? null,
    environment: process.env.VERCEL_ENV ?? 'development',
  };
}
