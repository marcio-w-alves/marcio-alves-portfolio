import type { Metadata } from 'next';

// Declared on the page rather than the root layout: a canonical inherited by
// every route would point each of them at the home page.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <main />;
}
