import { container } from '../composition-root';
import { siteName } from '../env';
import { panel } from '../ui/panel';

export const route = [container, siteName, panel];
