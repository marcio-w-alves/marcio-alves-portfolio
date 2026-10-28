import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { RichComponent } from '@/core/assistant/components';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { Eyebrow } from '@/ui/primitives';
import { RichBlock } from '@/ui/rich';
import { exampleBlocks } from '@/ui/rich/examples';
import { knowledge } from '../../site-knowledge';

// Every rich answer block, with the data the fast path really sends, at the
// answer column's width and at a phone's. A development tool, so production
// answers 404.
export const metadata: Metadata = { robots: { index: false } };

const exampleBlock = exampleBlocks(createFastPath(knowledge));

function demos(): readonly { readonly title: string; readonly block: RichComponent }[] {
  const timeline = exampleBlock('timeline');
  const contact = exampleBlock('contact');
  return [
    { title: 'Metrics', block: exampleBlock('metrics') },
    { title: 'Timeline', block: timeline },
    {
      title: 'Timeline — Deel open',
      block: { ...timeline, props: { ...timeline.props, expanded: ['deel'] } },
    },
    { title: 'Skills', block: exampleBlock('skills') },
    { title: 'Projects', block: exampleBlock('projects') },
    { title: 'Table', block: exampleBlock('table') },
    { title: 'Note', block: exampleBlock('note') },
    { title: 'Details', block: exampleBlock('details') },
    { title: 'Contact — no résumé yet', block: contact },
    {
      title: 'Contact — with a résumé',
      block: { ...contact, props: { ...contact.props, resumeUrl: '/resume.pdf' } },
    },
  ];
}

export default function RichWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="flex flex-col gap-12 p-8">
      <Column label="Answer column" className="max-w-column" />
      <Column label="Phone" className="w-97.5" />
    </main>
  );
}

function Column({ label, className }: { readonly label: string; readonly className: string }) {
  return (
    <section className={className} aria-label={label}>
      <div className="@container/ma flex flex-col gap-8 text-15.5">
        <Eyebrow as="h2">{label}</Eyebrow>
        {demos().map(({ title, block }) => (
          <div key={title} className="flex flex-col gap-3.5">
            <Eyebrow as="h3">{title}</Eyebrow>
            <RichBlock block={block} />
          </div>
        ))}
      </div>
    </section>
  );
}
