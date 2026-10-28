import { z } from 'zod';

/**
 * Server secrets, validated once at the system boundary.
 *
 * Resolved lazily so a build never fails for lack of runtime secrets.
 */
const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1).optional(),
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
 * is injected into every build, previews included, and becomes the custom
 * domain once one is assigned — so a deployment can never advertise localhost
 * or a preview URL as its canonical address.
 */
export function siteUrl(): URL {
  const explicit = process.env.SITE_URL;
  if (explicit) return new URL(z.url().parse(explicit));

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return new URL(`https://${production}`);

  return new URL('http://localhost:3000');
}
