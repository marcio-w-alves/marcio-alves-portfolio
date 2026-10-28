'use client';

import { AnswerBody } from '../chat/answer-body';

interface ArticleProps {
  readonly title: string;
  readonly markdown: string;
}

/** A page of prose in the answers' own typography, so it reads like the rest of the site. */
export function Article({ title, markdown }: ArticleProps) {
  return (
    <article className="mx-auto w-full max-w-column px-8 pt-10 pb-16 @max-phone/ma:px-4 @max-phone/ma:pt-6">
      <h1 className="mb-6 font-display text-30 leading-heading font-semibold tracking-heading text-ink @max-phone/ma:text-27">
        {title}
      </h1>
      {/* A page is read top to bottom, so its sections need more weight than an answer's. */}
      <div className="[&_h2]:mt-7 [&_h2]:text-18 [&_h2]:tracking-heading">
        <AnswerBody parts={[{ type: 'text', id: 'article', text: markdown }]} streaming={false} />
      </div>
    </article>
  );
}
