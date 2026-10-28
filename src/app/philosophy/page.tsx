import { TopicPage, topicMetadata } from '../topic-page';

export const metadata = topicMetadata('philosophy');

export default function Page() {
  return <TopicPage topic="philosophy" />;
}
