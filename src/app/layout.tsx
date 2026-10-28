import type { Metadata } from 'next';
import { siteUrl } from '@/env';
import { fontVariables } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Marcio Alves — Frontend Engineer',
  description:
    'Portfolio of Marcio Alves, frontend engineer, with an AI assistant grounded in his documented experience.',
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
