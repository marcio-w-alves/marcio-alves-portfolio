/**
 * Module-boundary rules.
 *
 * The architecture's central claim is that source-code dependencies point
 * inward: `src/core` holds policy and knows nothing about the framework, the
 * network, or the composition root that wires it. A convention nobody checks
 * is a convention that erodes, so the claim is enforced here and in CI.
 */
// Only what Vitest runs counts as a test; any other name is shipped code and obeys every rule.
const TESTS = '\\.test\\.tsx?$';
const ROOTS = 'composition-root|site-root|env';
// A folder (`ui/`) or a single module (`env.ts`), never a prefix of a longer name.
const MODULE_END = '(/|\\.)';

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
      name: 'core-is-innermost',
      comment:
        'src/core may not reach the app, the interface, the adapters, the profile, the roots, or ' +
        'the test helpers. Where the flow of control needs to go outward, invert it with a port ' +
        'under src/core/**/ports; where it needs the owner, take the value as a parameter.',
      severity: 'error',
      from: { path: '^src/core', pathNot: TESTS },
      to: {
        path: `^src/(app|http|site|ui|infrastructure|profile|testing|${ROOTS})${MODULE_END}`,
      },
    },
    {
      name: 'core-tests-stay-inside',
      comment:
        "The core's tests exercise the core: they may read a profile or the fictional fixture " +
        'to have a record to answer from, but not the app, the interface or the adapters.',
      severity: 'error',
      from: { path: `^src/core/.*${TESTS}` },
      to: { path: `^src/(app|http|site|ui|infrastructure|${ROOTS})${MODULE_END}` },
    },
    {
      name: 'knowledge-is-below-assistant',
      comment:
        'The knowledge base is the data the assistant answers from. It cannot know the assistant ' +
        'or the conversation, or the two packages become one cycle.',
      severity: 'error',
      from: { path: '^src/core/knowledge/' },
      to: { path: '^src/core/(assistant|conversation)/' },
    },
    {
      name: 'ui-is-presentation',
      comment:
        'src/ui renders what it is given. Routes, adapters, the composition root, and server ' +
        'configuration stay out of it, so none of them can leak into the client bundle.',
      severity: 'error',
      from: { path: '^src/ui/', pathNot: TESTS },
      to: { path: `^src/(app|infrastructure|${ROOTS})${MODULE_END}` },
    },
    {
      name: 'infrastructure-is-a-plugin',
      comment:
        'Adapters implement ports owned by the core. They never call back into the routes, the ' +
        'interface, or the root that wires them.',
      severity: 'error',
      from: { path: '^src/infrastructure/', pathNot: TESTS },
      to: { path: `^src/(app|ui|composition-root)${MODULE_END}` },
    },
    {
      name: 'app-goes-through-roots',
      comment:
        'Routes reach adapters only through the composition root, which decides which ' +
        'implementation runs. A route that imports an adapter has wired it by hand.',
      severity: 'error',
      from: { path: '^src/app/', pathNot: TESTS },
      to: { path: '^src/infrastructure/' },
    },
    {
      name: 'profile-is-configuration',
      comment:
        "The profile is the owner's data and copy. It may use the core's types and helpers, " +
        'never the app, the adapters, the roots that read it, or the test helpers.',
      severity: 'error',
      from: { path: '^src/profile/', pathNot: TESTS },
      to: { path: `^src/(app|http|infrastructure|testing|${ROOTS})${MODULE_END}` },
    },
    {
      name: 'profile-uses-only-types-outward',
      comment:
        'The profile satisfies types the interface and the site own; importing their code ' +
        'would make the data depend on how it is shown.',
      severity: 'error',
      from: { path: '^src/profile/', pathNot: TESTS },
      to: { path: `^src/(ui|site)${MODULE_END}`, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'only-roots-read-the-profile',
      comment:
        'The core receives the owner as values, so nothing but the roots that bind it, the ' +
        'scripts and the tests reads the profile. The app reads it until its helpers move ' +
        'behind a root.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [TESTS, `^src/(profile|testing|app|${ROOTS})${MODULE_END}`],
      },
      to: { path: '^src/profile/' },
    },
    {
      name: 'fixtures-only-in-tests',
      comment: 'src/testing holds test doubles and stand-ins; shipped code never needs them.',
      severity: 'error',
      from: { path: '^src/', pathNot: [TESTS, '^src/testing/'] },
      to: { path: '^src/testing/' },
    },
    {
      name: 'shipped-code-never-imports-tests',
      comment:
        'Tests are exempt from the layer rules because nothing ships them. A shipped module that ' +
        'imports one would carry that exemption into the bundle.',
      severity: 'error',
      from: { path: '^src/', pathNot: TESTS },
      to: { path: TESTS },
    },
    {
      name: 'src-never-imports-scripts',
      comment:
        'Scripts are tooling that runs beside the site. They may use src, never the reverse.',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^scripts/' },
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
      from: { path: '^src', pathNot: [TESTS, '^src/testing/'] },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // The fixtures violate the rules on purpose; the boundary tests cruise them on their own.
    exclude: { path: ['(^|/)\\.next/', '^src/architecture/fixtures/'] },
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
