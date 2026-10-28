'use client';

import { useState } from 'react';
import { suggestions, topics, type TopicId } from '@/core/assistant/topics';
import { knowledgeBase } from '@/core/knowledge/knowledge-base';
import { SuggestedQuestions, TopicChips, WelcomeLayout, WelcomeScreen } from '@/ui/welcome';

// The shell owns this state in the app; here it only proves the callbacks fire.
export function WelcomeDemo() {
  const [topic, setTopic] = useState<TopicId>('overview');
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState('nothing yet');

  function pickTopic(id: TopicId) {
    setTopic(id);
    setPage(0);
    setPicked(`topic ${id}`);
  }

  return (
    <WelcomeLayout>
      <WelcomeScreen welcome={knowledgeBase.welcome} />
      <TopicChips topics={topics} onPick={pickTopic} />
      <div className="grid h-35 place-items-center rounded-xl border border-dashed border-border-strong text-13 text-ink-muted">
        Composer (POR-10) · last pick: {picked}
      </div>
      <SuggestedQuestions
        title="Suggested questions"
        questions={suggestions(topic, page, 4)}
        onPick={setPicked}
        onShuffle={() => {
          setPage((current) => current + 1);
        }}
      />
    </WelcomeLayout>
  );
}

export function FollowUpChipsDemo() {
  const [picked, setPicked] = useState('nothing yet');

  return (
    <div className="flex flex-col gap-2">
      <SuggestedQuestions
        variant="chips"
        title="Follow-up questions"
        questions={suggestions('experience', 1, 3)}
        onPick={setPicked}
      />
      <p className="text-13 text-ink-muted">Last pick: {picked}</p>
    </div>
  );
}
