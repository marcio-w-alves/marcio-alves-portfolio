'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { suggestedQuestions, topicById, type TopicId } from '@/core/assistant/topics';
import { latestAnswerId } from '@/core/conversation/conversation';
import type { AssistantMessage as Answer, Conversation } from '@/core/conversation/messages';
import { toPlainText } from '@/core/conversation/plain-text';
import { roleById } from '@/core/knowledge/knowledge-base';
import type { Welcome } from '@/core/knowledge/types';
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

interface ChatWorkspaceProps {
  readonly profile: SidebarProfile;
  readonly links: SidebarLinks;
  readonly topics: readonly SidebarTopic[];
  readonly welcome: Welcome;
  /** The longest question the API accepts. */
  readonly maxQuestionLength: number;
  /** A conversation to open on, to show a known state; a visitor starts empty. */
  readonly initialConversation?: Conversation | undefined;
  readonly initialDrawerOpen?: boolean | undefined;
}

const SUGGESTION_COUNT = 4;
// Within this distance of the bottom the visitor is reading the newest message.
const PINNED_WITHIN_PX = 80;

function relatedRole(message: Answer) {
  return message.related ? roleById(message.related) : undefined;
}

/** Owns the conversation and hands plain data and callbacks to the presentational parts. */
export function ChatWorkspace({
  profile,
  links,
  topics,
  welcome,
  maxQuestionLength,
  initialConversation,
  initialDrawerOpen,
}: ChatWorkspaceProps) {
  const chat = useChat(initialConversation);
  const { conversation } = chat;
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
  }, [conversation, inConversation]);

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

  function pickTopic(topic: TopicId) {
    pinned.current = true;
    chat.pickTopic(topic);
    setDrawerOpen(false);
  }

  function startOver() {
    chat.startOver();
    setDrawerOpen(false);
    setShowJump(false);
    pinned.current = true;
    scrollRef.current?.scrollTo({ top: 0 });
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
      onStop={chat.stop}
      status={chat.streaming ? 'streaming' : 'idle'}
      placeholder={variant === 'hero' ? welcome.placeholder : 'Ask a follow-up question...'}
      helper={welcome.helper}
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
          activeTopic={conversation.topic}
          links={links}
          onPickTopic={pickTopic}
          onNewConversation={startOver}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      }
    >
      {inConversation && (
        <>
          <h1 className="sr-only">Conversation with Marcio&apos;s portfolio assistant</h1>
          <ConversationTopBar topic={topicById(conversation.topic)} onNewConversation={startOver} />
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
            aria-busy={chat.streaming}
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
              const role = relatedRole(message);
              return (
                <li key={message.id} className="animate-turn">
                  <AssistantMessage
                    message={message}
                    isLatest={message.id === latestId}
                    topicLabel={
                      message.kind === 'intro' && message.topicId
                        ? topicById(message.topicId).label
                        : undefined
                    }
                    relatedLabel={role ? `View ${role.company} experience` : undefined}
                    onFollowUp={ask}
                    onCopy={(answer) => copyText(toPlainText(answer.parts))}
                    onRetry={chat.retry}
                    onEdit={editQuestion}
                    onRate={chat.rate}
                    onViewRelated={() => {
                      if (role) ask(`Tell me about his time at ${role.company}.`);
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
              questions={suggestedQuestions(conversation.topic, 0, SUGGESTION_COUNT).map(
                ({ question, short }) => ({ question, label: short }),
              )}
              onPick={ask}
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
