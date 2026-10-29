/**
 * The owner's baseline is owner data, and CI logs and artifacts are public:
 * in CI only the fictional profile may be captured or compared.
 */
export function assertProfileAllowedHere(
  profile: string,
  env: Readonly<Record<string, string | undefined>>,
): void {
  const inCI = Boolean(env.CI) || Boolean(env.GITHUB_ACTIONS);
  if (inCI && profile !== 'fixture') {
    throw new Error(
      `Refusing the "${profile}" profile in CI: a baseline of the owner's site is never ` +
        'captured or compared there. Pass --profile fixture.',
    );
  }
}
