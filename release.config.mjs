/**
 * Versioning is derived from commit history, never typed by hand.
 *
 * The release is a git tag plus a GitHub Release with generated notes. There
 * is deliberately no CHANGELOG.md and no commit back to the trunk: the
 * Releases page already renders the same history, linked to its commits, and
 * writing a file back would mean a bot commit on every release — one that
 * would have to be exempted from the project's own commit rules to be allowed
 * through.
 *
 * `version` in package.json therefore stays at its placeholder. Nothing reads
 * it, the site is not published to a registry, and a number sitting in a file
 * is a number somebody will eventually edit.
 *
 * The plugins keep their default preset. An explicit `conventionalcommits`
 * preset was tried and removed: its current major needs a newer changelog
 * writer than release-notes-generator ships, and it bought nothing — the
 * default resolves feat to minor, fix and perf to patch, and a BREAKING
 * CHANGE footer to major, which is exactly the policy this project wants.
 */
const releaseConfig = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/github',
  ],
};

export default releaseConfig;
