import { createResponseKit } from '@/core/assistant/response-kit';
import { createTopicIntro } from '@/core/assistant/topic-pages';
import { createTopicCatalog } from '@/core/assistant/topics';
import { localize } from '@/core/knowledge/localize';
import { profile } from '@/profile';

// The pages read the profile here, on the server, and hand the browser plain
// props: the client never imports the record.
export const knowledge = localize(profile.knowledge, 'en');
export const responseKit = createResponseKit(knowledge);
export const topicCatalog = createTopicCatalog(responseKit);
export const topicIntro = createTopicIntro(responseKit, topicCatalog);
