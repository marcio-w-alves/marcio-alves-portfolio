import type { citation } from '../core/assistant/citation';
import type { PanelCopy } from '../ui/panel';

export const profile: { readonly cited: typeof citation; readonly copy: PanelCopy } = {
  cited: 'Resume',
  copy: { title: 'Ada Rivera' },
};
