import { connection } from 'next/server';
import { getContainer } from '@/composition-root';
import { createHealthHandler } from '@/http/health-handler';

export async function GET(): Promise<Response> {
  // Without this the response would be prerendered once, at build time.
  await connection();
  return createHealthHandler(getContainer())();
}
