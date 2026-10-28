import { container } from '../composition-root';
import { siteName } from '../env';
import { handler } from '../http/handler';
import { site } from '../site-root';
import { panel } from '../ui/panel';

export const route = [container, siteName, handler, site, panel];
