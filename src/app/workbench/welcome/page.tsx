import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/ui/primitives';
import { FollowUpChipsDemo, WelcomeDemo } from './welcome-demo';

// The welcome column at desktop and phone widths, for checking it against the
// design. A development tool, so production answers 404.
export const metadata: Metadata = { robots: { index: false } };

export default function WelcomeWorkbenchPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="flex flex-col gap-8 p-8">
      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Desktop</Eyebrow>
        <div className="@container/ma h-225 w-295 overflow-y-auto outline outline-border">
          <WelcomeDemo />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Phone</Eyebrow>
        <div className="@container/ma h-211 w-97.5 overflow-y-auto outline outline-border">
          <WelcomeDemo />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow as="h2">Follow-up chips</Eyebrow>
        <div className="@container/ma w-190">
          <FollowUpChipsDemo />
        </div>
      </section>
    </main>
  );
}
