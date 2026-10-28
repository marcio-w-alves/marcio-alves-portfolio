import { getContainer } from '@/composition-root';
import { createChatHandler } from '@/http/chat-handler';

// Seconds; above the answer's own time limit (CHAT_REQUEST_TIMEOUT_MS, 60 s by
// default), so the visitor is told the answer was interrupted instead of the
// platform cutting the connection.
export const maxDuration = 75;

export function POST(request: Request): Promise<Response> {
  return createChatHandler(getContainer())(request);
}
