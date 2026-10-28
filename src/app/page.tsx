import type { Metadata } from 'next';
import { siteUrl } from '@/env';
import { ChatWorkspace } from '@/ui/chat/chat-workspace';
import { personStructuredData, serializeStructuredData } from './structured-data';
import { workspaceProps } from './workspace-props';

// Declared on the page rather than the root layout: a canonical inherited by
// every route would point each of them at the home page.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(personStructuredData(siteUrl())),
        }}
      />
      <ChatWorkspace {...workspaceProps()} />
    </>
  );
}
