/**
 * Module-boundary rules.
 *
 * The architecture's central claim is that source-code dependencies point
 * inward: `src/core` holds policy and knows nothing about the framework, the
 * network, or the composition root that wires it. A convention nobody checks
 * is a convention that erodes, so the claim is enforced here and in CI.
 */
module.exports = {
  forbidden: [
    {
      name: 'core-is-framework-free',
      comment:
        'src/core must stay portable: no Next, React, or vendor SDK. Zod is the one allowed ' +
        'dependency, because the assistant tool contracts are defined as Zod schemas and those ' +
        'schemas are part of the policy, not of an adapter. Tests are exempt: they verify the ' +
        'core but are not part of what it ships.',
      severity: 'error',
      from: { path: '^src/core', pathNot: '\\.test\\.tsx?$' },
      to: {
        dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-no-pkg'],
        pathNot: 'node_modules/zod/',
      },
    },
    {
      name: 'core-depends-on-nothing-outward',
      comment:
        'src/core may not reach the app, the adapters, or the composition root. Where the flow ' +
        'of control needs to go outward, invert it with a port under src/core/**/ports.',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(app|infrastructure|components|composition-root|env)' },
    },
    {
      name: 'no-circular',
      comment: 'A cycle means the two modules are really one, and neither can be understood alone.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'A dependency the resolver cannot find is a broken import or a missing package.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-dev-dep-in-src',
      comment: 'Shipped code may only import runtime dependencies.',
      severity: 'error',
      from: { path: '^src', pathNot: '\\.(test|spec)\\.(ts|tsx)$' },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)\\.next/' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
