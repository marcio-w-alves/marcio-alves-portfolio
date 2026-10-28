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
