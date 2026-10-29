import { z } from 'zod';
import {
  profileDataSchema,
  type ProfileData,
  type ProfileIssue,
} from '../../../src/profile/schema';
import { locate, type DecodedBundle } from '../bundle/decode';
import { DOCUMENTS } from '../bundle/layout';
import { pointer, type BundleProblem } from '../bundle/problems';

const SHAPE_REMEDY = 'write it as profiles/example does';

/** A problem with a part of the profile, placed in the document it was written in. */
export function problemAt({ path, message }: ProfileIssue, remedy: string): BundleProblem {
  const { document, at } = locate(path);
  return at ? { document, at, problem: message, remedy } : { document, problem: message, remedy };
}

const privacySchema = z.strictObject({
  phone: z.array(z.string().regex(/\S/)).optional(),
  address: z.array(z.string().regex(/\S/)).optional(),
  phrases: z.array(z.string().regex(/\S/)).optional(),
});

/** Extra terms of the person's the privacy scan looks for, which the record cannot give. */
export type PrivacyTerms = z.infer<typeof privacySchema>;

export type SchemaResult =
  | { readonly ok: true; readonly data: ProfileData; readonly privacy: PrivacyTerms }
  | { readonly ok: false; readonly problems: readonly BundleProblem[] };

/** The profile has the shape the site and the scripts read: every problem, by where it is written. */
export function checkSchema(decoded: DecodedBundle): SchemaResult {
  const data = profileDataSchema.safeParse(decoded.data);
  const privacy = privacySchema.safeParse(decoded.privacy ?? {});
  const problems = [
    ...(data.success ? [] : data.error.issues.map((issue) => problemAt(issue, SHAPE_REMEDY))),
    ...(privacy.success
      ? []
      : privacy.error.issues.map(({ path, message }) => ({
          document: DOCUMENTS.privacy,
          at: pointer(path),
          problem: message,
          remedy: SHAPE_REMEDY,
        }))),
  ];
  if (!data.success || !privacy.success) return { ok: false, problems };
  // Validated just above; the schema's inferred type is looser than the interface it checks.
  return { ok: true, data: data.data as unknown as ProfileData, privacy: privacy.data };
}
