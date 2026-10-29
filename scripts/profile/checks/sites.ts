import { sitePassageIssues, type ProfileData } from '../../../src/profile/schema';
import type { BundleProblem } from '../bundle/problems';
import { problemAt } from './schema';

/** Every site passage was read from a page the allow-list names, for the subject it names. */
export function checkSites(data: ProfileData): BundleProblem[] {
  return sitePassageIssues(data).map((issue) =>
    problemAt(
      issue,
      'add the page to sites/allow-list.yaml, then read the sites again (pnpm sites:ingest)',
    ),
  );
}
