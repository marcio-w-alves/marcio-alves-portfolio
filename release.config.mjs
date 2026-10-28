/**
 * Versioning is derived from commit history, never typed by hand.
 *
 * The release is a git tag plus a GitHub Release with generated notes. There
 * is deliberately no CHANGELOG.md and no commit back to `main`: the Releases
 * page already renders the same history, linked to its commits, and writing a
 * file back would mean a bot commit on every release — one that would have to
 * be exempted from the project's own commit rules to be allowed through.
 *
 * `version` in package.json therefore stays at its placeholder. Nothing reads
 * it, the site is not published to a registry, and a number sitting in a file
 * is a number somebody will eventually edit.
 */
const releaseConfig = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits' }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits' }],
    '@semantic-release/github',
  ],
};

export default releaseConfig;
