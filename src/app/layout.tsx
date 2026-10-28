import type { Metadata } from 'next';
import { Geist_Mono, Inter, Inter_Tight } from 'next/font/google';
import { siteUrl } from '@/env';
import './globals.css';

// The design's three faces, downloaded at build and served from this site.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Marcio Alves — Frontend Engineer',
  description:
    'Portfolio of Marcio Alves, frontend engineer, with an AI assistant grounded in his documented experience.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable}`}>
      <body className="bg-bg font-sans text-ink antialiased selection:bg-selection selection:text-ink">
        {children}
      </body>
    </html>
  );
}
