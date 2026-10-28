import { TopicPage, topicMetadata } from '../topic-page';

export const metadata = topicMetadata('projects');

export default function Page() {
  return <TopicPage topic="projects" />;
}
