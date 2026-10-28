import { z } from 'zod';

/**
 * Server environment, validated once at the system boundary.
 *
 * Resolved lazily so a build never fails for lack of runtime secrets.
 */
const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  GITHUB_TOKEN: z.string().min(1).optional(),
  SITE_URL: z.url(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
