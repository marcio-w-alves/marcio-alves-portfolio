import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import { siteUrl } from '@/env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Marcio Alves — Frontend Engineer',
  description:
    'Portfolio of Marcio Alves, frontend engineer, with an AI assistant grounded in his documented experience.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
