import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Marcio Alves — Frontend Engineer',
  description:
    'Portfolio of Marcio Alves, frontend engineer, with an AI assistant grounded in his documented experience.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
