import { profile } from './profile/index';
import { createSite } from './site/create-site';

export const site = createSite(profile.copy.title);
