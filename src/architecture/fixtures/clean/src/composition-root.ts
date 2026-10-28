import { adapter } from './infrastructure/adapter';
import { profile } from './profile/index';

export const container = [adapter, profile];
