import type { Metadata } from 'next';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { siteUrl } from '@/env';
import { fontVariables } from './fonts';
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
    siteName: knowledgeBase.profile.name,
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
        {children}
      </body>
    </html>
  );
}
