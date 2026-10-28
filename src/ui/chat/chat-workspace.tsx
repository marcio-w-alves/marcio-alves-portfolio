'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SuggestedQuestion } from '@/core/assistant/topics';
import type { TopicId } from '@/core/chat/topic-id';
import { latestAnswerId } from '@/core/conversation/conversation';
import type { Conversation } from '@/core/conversation/messages';
import { toPlainText } from '@/core/conversation/plain-text';
import type { Welcome } from '@/core/knowledge/schema';
import { ChatComposer, ComposerDock, JumpToLatest, type ChatComposerHandle } from '../composer';
import { AppShell } from '../shell/app-shell';
import { ConversationTopBar } from '../shell/conversation-top-bar';
import {
  Sidebar,
  type SidebarLinks,
  type SidebarProfile,
  type SidebarTopic,
} from '../shell/sidebar';
import { SuggestedQuestions, WelcomeLayout, WelcomeScreen } from '../welcome';
import { AssistantMessage } from './assistant-message';
import { copyText } from './copy-text';
import { useChat } from './use-chat';
import { useReveal } from './use-reveal';

interface ChatWorkspaceProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
  readonly welcome: Welcome;
  /** The name the assistant goes by beside its answers. */
  readonly assistantName: string;
  /** Each role's company, by role id, for the link under an answer about one role. */
  readonly companies: Readonly<Record<string, string>>;
  /** The questions the welcome screen offers. */
  readonly suggestions: readonly SuggestedQuestion[];
  /** The conversation the page opens with, and starts over from. */
  readonly seed: Conversation;
  /** The longest question the API accepts. */
  readonly maxQuestionLength: number;
  /** The page this workspace is: the overview is the welcome screen, every other topic its own page. */
  readonly topic?: TopicId;
  /** A conversation to open on, to show a known state; a visitor starts empty. */
  readonly initialConversation?: Conversation | undefined;
  readonly initialDrawerOpen?: boolean | undefined;
}

// Within this distance of the bottom the visitor is reading the newest message.
const PINNED_WITHIN_PX = 80;

/** A page's own entry in the navigation the server built, which lists every topic. */
function topicIn(topics: readonly SidebarTopic[], id: string): SidebarTopic {
  const found = topics.find((item) => item.id === id);
  if (!found) throw new Error(`The navigation has no "${id}" page.`);
  return found;
}

/** Owns the conversation and hands plain data and callbacks to the presentational parts. */
export function ChatWorkspace({
  profile,
  links,
  topics,
  welcome,
  assistantName,
  companies,
  suggestions,
  seed,
  maxQuestionLength,
  topic = 'overview',
  initialConversation,
  initialDrawerOpen,
}: ChatWorkspaceProps) {
  const chat = useChat(topic, seed, initialConversation);
  const { conversation } = chat;
  const currentTopic = topicIn(topics, conversation.topic);
  const reveal = useReveal(conversation);
  // The answer is still coming in, or still being typed out.
  const busy = chat.streaming || reveal.typing;
  const [draft, setDraft] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen ?? false);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const pinned = useRef(true);
  // Focus is moved after the render that may swap one composer for the other.
  const [focusRequest, setFocusRequest] = useState(0);

  const inConversation = conversation.messages.length > 0;
  const latestId = latestAnswerId(conversation);

  // New content is followed only while the visitor is already at the bottom;
  // a conversation the page opens with is read from its start.
  const openedWith = useRef(conversation);
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (conversation === openedWith.current) return;
    if (scroller && pinned.current && inConversation) scroller.scrollTop = scroller.scrollHeight;
  }, [conversation, inConversation, reveal.shown]);

  useEffect(() => {
    if (focusRequest > 0) composerRef.current?.focus();
  }, [focusRequest]);

  const focusComposer = () => {
    setFocusRequest((request) => request + 1);
  };

  function scrollToLatest() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    pinned.current = true;
    setShowJump(false);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function handleScroll() {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const atBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < PINNED_WITHIN_PX;
    pinned.current = atBottom;
    setShowJump(!atBottom && inConversation);
  }

  function ask(question: string): boolean {
    pinned.current = true;
    if (!chat.ask(question)) return false;
    setDrawerOpen(false);
    return true;
  }

  function submitDraft() {
    if (ask(draft)) setDraft('');
  }

  function startOver() {
    chat.startOver();
    setDrawerOpen(false);
    setShowJump(false);
    pinned.current = true;
    scrollRef.current?.scrollTo({ top: 0 });
  }

  function stop() {
    chat.stop();
    reveal.finish();
  }

  function editQuestion(answerId: string) {
    setDraft(chat.edit(answerId));
    focusComposer();
  }

  const composer = (variant: 'hero' | 'dock') => (
    <ChatComposer
      ref={composerRef}
      variant={variant}
      inputId={`composer-${variant}`}
      value={draft}
      onChange={setDraft}
      onSubmit={submitDraft}
      onStop={stop}
      status={busy ? 'streaming' : chat.waiting ? 'waiting' : 'idle'}
      placeholder={variant === 'hero' ? welcome.placeholder : 'Ask a follow-up question...'}
      helper={
        chat.waiting ? 'Another answer is on its way. Send this once it is done.' : welcome.helper
      }
      maxLength={maxQuestionLength}
    />
  );

  return (
    <AppShell
      profile={profile}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={setDrawerOpen}
      onNewConversation={startOver}
      navigation={
        <Sidebar
          profile={profile}
          topics={topics}
          activeTopic={topic}
          links={links}
          onNewConversation={startOver}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      }
    >
      {inConversation && (
        <>
          <h1 className="sr-only">
            {topic === 'overview'
              ? "Conversation with Marcio's portfolio assistant"
              : `${topicIn(topics, topic).label} — ${profile.name}`}
          </h1>
          <ConversationTopBar topic={currentTopic} onNewConversation={startOver} />
        </>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {inConversation ? (
          <ol
            aria-label="Conversation"
            aria-busy={busy}
            className="mx-auto flex max-w-column list-none flex-col gap-10 px-8 pt-3 pb-8 @max-phone/ma:gap-7.5 @max-phone/ma:px-4 @max-phone/ma:pt-4 @max-phone/ma:pb-6"
          >
            {conversation.messages.map((message) => {
              if (message.role === 'user') {
                return (
                  <li key={message.id} className="flex animate-turn justify-end">
                    <p className="m-0 max-w-bubble rounded-bubble bg-fill px-4 py-2.5 text-15 leading-reading wrap-anywhere whitespace-pre-wrap text-ink @max-phone/ma:max-w-bubble-phone">
                      <span className="sr-only">You asked: </span>
                      {message.text}
                    </p>
                  </li>
                );
              }
              const company = message.related ? companies[message.related] : undefined;
              return (
                <li key={message.id} className="animate-turn">
                  <AssistantMessage
                    message={reveal.view(message)}
                    assistantName={assistantName}
                    busy={busy || chat.waiting}
                    isLatest={message.id === latestId}
                    topicLabel={
                      message.kind === 'intro' && message.topicId
                        ? topicIn(topics, message.topicId).label
                        : undefined
                    }
                    relatedLabel={company ? `View ${company} experience` : undefined}
                    onFollowUp={ask}
                    onCopy={(answer) => copyText(toPlainText(answer.parts))}
                    onRetry={chat.retry}
                    onEdit={editQuestion}
                    onRate={chat.rate}
                    onViewRelated={() => {
                      if (company) ask(`Tell me about his time at ${company}.`);
                    }}
                    onAskFollowUp={focusComposer}
                  />
                </li>
              );
            })}
          </ol>
        ) : (
          <WelcomeLayout>
            <WelcomeScreen welcome={welcome} />
            {composer('hero')}
            <SuggestedQuestions
              title="Suggested questions"
              hideTitle
              align="center"
              questions={suggestions.map(({ question, short }) => ({ question, label: short }))}
              onPick={ask}
              disabled={chat.waiting}
            />
          </WelcomeLayout>
        )}
      </div>

      {inConversation && (
        <ComposerDock jumpToLatest={showJump ? <JumpToLatest onClick={scrollToLatest} /> : null}>
          {composer('dock')}
        </ComposerDock>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {chat.announcement}
      </p>
    </AppShell>
  );
}
