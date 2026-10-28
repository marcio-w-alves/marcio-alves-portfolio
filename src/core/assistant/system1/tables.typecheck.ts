import type { NEXT_INTENT, TOPIC_DEFAULT } from './router';

// Checked by tsc, never run: if either table lost its union key type, a
// misspelt key would resolve, the directive above it would be unused, and the
// type check would fail.

// @ts-expect-error -- 'carrer' is not a ScoredIntent.
export type MisspeltIntent = (typeof NEXT_INTENT)['carrer'];

// @ts-expect-error -- 'skils' is not a TopicId.
export type MisspeltTopic = (typeof TOPIC_DEFAULT)['skils'];
