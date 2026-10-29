import { MAX_HISTORY_MESSAGES } from '../../chat/request';
import { MAX_CALLS_PER_ROUND, MAX_OUTPUT_TOKENS, MAX_ROUNDS } from '../system2/model-assistant';

/** The assistant's limits as the about page names them: `{{limits.maxRounds}}`. */
export const ASSISTANT_LIMITS: Readonly<Record<string, number>> = {
  maxRounds: MAX_ROUNDS,
  maxCallsPerRound: MAX_CALLS_PER_ROUND,
  maxOutputTokens: MAX_OUTPUT_TOKENS,
  maxHistoryMessages: MAX_HISTORY_MESSAGES,
};
