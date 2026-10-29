import { testAdminUrl } from './database';

/**
 * The store tests prove what the store does against a real Postgres, so a run
 * without one is a failure, never a skip: a green suite that quietly tested
 * nothing is worse than a red one.
 */
export default function setup(): void {
  try {
    testAdminUrl();
  } catch (error) {
    // Vitest reports a failing global setup as a stack, and the stack is not
    // the point: what to do about it is.
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    throw error;
  }
}
