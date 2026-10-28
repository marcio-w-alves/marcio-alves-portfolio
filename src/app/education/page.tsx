import { TopicPage, topicMetadata } from '../topic-page';

export const metadata = topicMetadata('education');

export default function Page() {
  return <TopicPage topic="education" />;
}
