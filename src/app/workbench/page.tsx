import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, ButtonLink, Eyebrow, Icon, IconButton, Tag } from '@/ui/primitives';

// Every primitive in every variant, on one page, for checking them against the
// design. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function WorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="flex flex-col gap-8 p-8">
      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Buttons</Eyebrow>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">
            <Icon name="mail" size="sm" />
            Contact Marcio
          </Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" size="sm">
            Small primary
          </Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="#workbench">
            <Icon name="download" size="sm" />
            Download résumé
          </ButtonLink>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Icon buttons</Eyebrow>
        <div className="flex items-center gap-1">
          <IconButton icon="copy" label="Copy answer" />
          <IconButton icon="refresh" label="Retry" />
          <IconButton icon="thumbsUp" label="Helpful" />
          <IconButton icon="menu" label="Open navigation" size="touch" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Tags</Eyebrow>
        <div className="flex items-center gap-2">
          <Tag>React</Tag>
          <Tag tone="accent">Current</Tag>
          <Tag>
            <Icon name="file" size="xs" />
            PDF
          </Tag>
        </div>
      </section>
    </main>
  );
}
