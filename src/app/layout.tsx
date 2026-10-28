import type { Metadata } from 'next';
import { siteUrl } from '@/env';
import { ConversationsProvider } from '@/ui/chat/conversation-store';
import { fontVariables } from './fonts';
import { knowledge } from './site-knowledge';
import './globals.css';

const title = 'Marcio Alves — Frontend Engineer';
const description =
  'Portfolio of Marcio Alves, frontend engineer, with an AI assistant grounded in his documented experience.';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title,
  description,
  openGraph: {
    type: 'website',
    siteName: knowledge.profile.name,
    locale: 'en_US',
    title,
    description,
  },
  twitter: { card: 'summary_large_image', title, description },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
        <ConversationsProvider>{children}</ConversationsProvider>
      </body>
    </html>
  );
}
