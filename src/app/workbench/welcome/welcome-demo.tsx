'use client';

import { useState } from 'react';
import { suggestedQuestions, suggestions } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { SuggestedQuestions, WelcomeLayout, WelcomeScreen } from '@/ui/welcome';

// The shell owns this state in the app; here it only proves the callbacks fire.
export function WelcomeDemo() {
  const [picked, setPicked] = useState('nothing yet');

  return (
    <WelcomeLayout>
      <WelcomeScreen welcome={knowledgeBase.welcome} />
      <div className="grid h-35 place-items-center rounded-xl border border-dashed border-border-strong text-13 text-ink-muted">
        Composer · last pick: {picked}
      </div>
      <SuggestedQuestions
        title="Suggested questions"
        hideTitle
        align="center"
        questions={suggestedQuestions('overview', 0, 4).map(({ question, short }) => ({
          question,
          label: short,
        }))}
        onPick={setPicked}
      />
    </WelcomeLayout>
  );
}

export function FollowUpChipsDemo() {
  const [picked, setPicked] = useState('nothing yet');

  return (
    <div className="flex flex-col gap-2">
      <SuggestedQuestions
        title="Follow-up questions"
        questions={suggestions('experience', 1, 3).map((question) => ({ question }))}
        onPick={setPicked}
      />
      <p className="text-13 text-ink-muted">Last pick: {picked}</p>
    </div>
  );
}
