import { notFound } from 'next/navigation';
import { site } from '@/site-root';

const page = site.aboutPage();

export const metadata = page?.metadata ?? {};

export default function Page() {
  if (!page) notFound();
  return <page.Page />;
}
