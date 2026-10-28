import { TopicPage, topicMetadata } from '../topic-page';

export const metadata = topicMetadata('skills');

export default function Page() {
  return <TopicPage topic="skills" />;
}
