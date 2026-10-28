/**
 * Conventional Commits, plus the project's own rule: every subject ends with
 * the task it belongs to. The task key is what ties a commit to its plan entry
 * and its pull request, and semantic-release (POR-05) reads the type to decide
 * the version bump — so the format is load-bearing, not decoration.
 */
const TASK_KEY = /\(POR-\d{2,}\)$/;

const commitlintConfig = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'subject-task-key': ({ subject }) => [
          subject !== null && TASK_KEY.test(subject),
          'subject must end with its task key, e.g. "add the composer (POR-10)"',
        ],
      },
    },
  ],
  rules: {
    'subject-task-key': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
  },
};

export default commitlintConfig;
