'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TopicId } from '@/core/chat/topic-id';
import { latestAnswerId } from '@/core/conversation/conversation';
import type { Conversation } from '@/core/conversation/messages';
import { interpolate } from '@/core/i18n/format';
import { ChatComposer, ComposerDock, JumpToLatest, type ChatComposerHandle } from '../composer';
import { AppShell } from '../shell/app-shell';
import { ConversationTopBar } from '../shell/conversation-top-bar';
import {
  Sidebar,
  type SidebarLinks,
  type SidebarProfile,
  type SidebarPage,
  type SidebarTopic,
} from '../shell/sidebar';
import {
  SuggestedQuestions,
  WelcomeLayout,
  WelcomeScreen,
  type QuestionChoice,
  type WelcomeGreeting,
} from '../welcome';
import { useMessages } from '../i18n/i18n-provider';
import type { AssistantIdentity } from './assistant-message';
import { ConversationTurn } from './conversation-turn';
import { useChat } from './use-chat';
import { useReveal } from './use-reveal';

/** The greeting, and how the first composer invites a question. */
interface WelcomeCopy extends WelcomeGreeting {
  readonly placeholder: string;
  readonly helper: string;
}

interface ChatWorkspaceProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
  /** Pages beside the topics, without a conversation. */
  readonly pages?: readonly SidebarPage[] | undefined;
  readonly welcome: WelcomeCopy;
  /** How the assistant appears beside its answers. */
  readonly assistant: AssistantIdentity;
  /** The questions the welcome screen offers. */
  readonly suggestions: readonly QuestionChoice[];
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
  pages,
  welcome,
  assistant,
  suggestions,
  seed,
  maxQuestionLength,
  topic = 'overview',
  initialConversation,
  initialDrawerOpen,
}: ChatWorkspaceProps) {
  const messages = useMessages();
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
      placeholder={variant === 'hero' ? welcome.placeholder : messages.composer.followUpPlaceholder}
      helper={chat.waiting ? messages.composer.waiting : welcome.helper}
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
          pages={pages}
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
              ? messages.conversation.overviewHeading
              : interpolate(messages.conversation.topicHeading, {
                  topic: topicIn(topics, topic).label,
                })}
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
            aria-label={messages.conversation.label}
            aria-busy={busy}
            className="mx-auto flex max-w-column list-none flex-col gap-10 px-8 pt-3 pb-8 @max-phone/ma:gap-7.5 @max-phone/ma:px-4 @max-phone/ma:pt-4 @max-phone/ma:pb-6"
          >
            {conversation.messages.map((message) => (
              <ConversationTurn
                key={message.id}
                message={message}
                view={reveal.view}
                isLatest={message.id === latestId}
                topicLabel={(id) => topicIn(topics, id).label}
                assistant={assistant}
                busy={busy || chat.waiting}
                onAsk={ask}
                onRetry={chat.retry}
                onEdit={editQuestion}
                onRate={chat.rate}
                onAskFollowUp={focusComposer}
              />
            ))}
          </ol>
        ) : (
          <WelcomeLayout>
            <WelcomeScreen welcome={welcome} links={links} />
            {composer('hero')}
            <SuggestedQuestions
              title={messages.welcome.suggestedQuestions}
              hideTitle
              align="center"
              questions={suggestions}
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
