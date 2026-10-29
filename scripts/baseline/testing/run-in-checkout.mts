/**
 * Runs the enumeration in the checkout named on the command line, as the
 * capture does, in a process of its own: what a test interrupts.
 *
 *   tsx scripts/baseline/testing/run-in-checkout.mts <checkout>
 */
import { runInCheckout } from '../checkout';

const [checkout] = process.argv.slice(2);
if (!checkout) throw new Error('Pass the checkout.');
await runInCheckout(checkout, 'enumerate.mts', []);
