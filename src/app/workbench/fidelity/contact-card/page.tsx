import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ContactCard } from '@/ui/rich/contact-card';
import { responseKit } from '../../../site-knowledge';

// The design's ContactCard artboard: the call to action with the production contact.
// A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function ContactCardFidelityPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const block = responseKit.contactCard();
  if (block.component !== 'contact')
    throw new Error('responseKit.contactCard() built another block.');
  return (
    <div className="min-h-screen p-10">
      <ContactCard {...block.props} />
    </div>
  );
}
