import { TopicPage, topicMetadata } from '../topic-page';

export const metadata = topicMetadata('experience');

export default function Page() {
  return <TopicPage topic="experience" />;
}
