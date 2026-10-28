import type { Welcome } from '../core/knowledge/schema';

export const greeting = (welcome: Welcome) => welcome.heading;
