import { getContainer } from '@/composition-root';
import { createChatHandler } from '@/http/chat-handler';

export function POST(request: Request): Promise<Response> {
  return createChatHandler(getContainer())(request);
}
