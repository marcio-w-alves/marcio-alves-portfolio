import { chatRequestSchema } from '../core/chat/request-schema';

export const validate = chatRequestSchema.parse;
