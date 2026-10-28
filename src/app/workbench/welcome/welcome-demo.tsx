'use client';

import { useState } from 'react';
import type { SuggestedQuestion } from '@/core/assistant/topics';
import type { Welcome } from '@/core/knowledge/schema';
import { SuggestedQuestions, WelcomeLayout, WelcomeScreen } from '@/ui/welcome';

interface WelcomeDemoProps {
  readonly welcome: Welcome;
  readonly suggestions: readonly SuggestedQuestion[];
}

// The shell owns this state in the app; here it only proves the callbacks fire.
export function WelcomeDemo({ welcome, suggestions }: WelcomeDemoProps) {
  const [picked, setPicked] = useState('nothing yet');

  return (
    <WelcomeLayout>
      <WelcomeScreen welcome={welcome} />
      <div className="grid h-35 place-items-center rounded-xl border border-dashed border-border-strong text-13 text-ink-muted">
        Composer · last pick: {picked}
      </div>
      <SuggestedQuestions
        title="Suggested questions"
        hideTitle
        align="center"
        questions={suggestions.map(({ question, short }) => ({
          question,
          label: short,
        }))}
        onPick={setPicked}
      />
    </WelcomeLayout>
  );
}

export function FollowUpChipsDemo({ followUps }: { readonly followUps: readonly string[] }) {
  const [picked, setPicked] = useState('nothing yet');

  return (
    <div className="flex flex-col gap-2">
      <SuggestedQuestions
        title="Follow-up questions"
        questions={followUps.map((question) => ({ question }))}
        onPick={setPicked}
      />
      <p className="text-13 text-ink-muted">Last pick: {picked}</p>
    </div>
  );
}
