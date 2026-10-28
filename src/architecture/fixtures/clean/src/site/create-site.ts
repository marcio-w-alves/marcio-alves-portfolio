import { citation } from '../core/assistant/citation';
import { panel } from '../ui/panel';

export function createSite(owner: string) {
  return [owner, citation, panel];
}
