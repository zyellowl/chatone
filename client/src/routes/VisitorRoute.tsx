import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@librechat/client';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import Container from '~/components/Chat/Messages/Content/Container';
import MinimalMessages from '~/components/Chat/Messages/MinimalMessages';
import { VisitorChatForm } from '~/components/Chat/Input/ChatForm';
import {
  VisitorApiError,
  useCreateVisitorConversationMutation,
  useVisitorChatMutation,
  useVisitorSessionQuery,
  type VisitorQuota,
} from '~/data-provider/Visitor';
import { ChatViewFrame } from '~/components/Chat/ChatView';
import { VisitorLanding } from '~/components/Chat/Landing';
import { VisitorHeader } from '~/components/Chat/Header';
import Footer from '~/components/Chat/Footer';
import { useLocalize } from '~/hooks';

type VisitorMessage = { isCreatedByUser: boolean; text: string };

export default function VisitorRoute() {
  const localize = useLocalize();
  const embedded = new URLSearchParams(window.location.search).get('embed') === 'jojoo';
  const [messages, setMessages] = useState<VisitorMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [quota, setQuota] = useState<VisitorQuota | null>(null);
  const request = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const mutation = useVisitorChatMutation();
  const session = useVisitorSessionQuery();
  const createConversation = useCreateVisitorConversationMutation();
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (session.data?.quota) setQuota(session.data.quota);
  }, [session.data?.quota]);
  useEffect(() => {
    if (
      session.isSuccess &&
      session.data.quota.remaining > 0 &&
      !conversationId &&
      !createConversation.isPending &&
      !createConversation.isError
    ) {
      void createConversation
        .mutateAsync()
        .then((result) => setConversationId(result.conversationId))
        .catch(() =>
          setMessages([{ isCreatedByUser: false, text: localize('com_ui_error') }]),
        );
    }
  }, [
    conversationId,
    createConversation,
    localize,
    session.data,
    session.isSuccess,
  ]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages, busy]);

  function stop() {
    request.current?.abort();
    setBusy(false);
  }
  function reset() {
    stop();
    setMessages([]);
    mutation.reset();
    createConversation.reset();
    setGeneration((value) => value + 1);
    setConversationId(null);
  }
  async function submit(message: string) {
    if (busy || !conversationId || (quota?.remaining ?? 0) <= 0) return;
    const controller = new AbortController();
    request.current = controller;
    setMessages((current) => [...current, { isCreatedByUser: true, text: message }].slice(-60));
    setBusy(true);
    try {
      const result = await mutation.mutateAsync({
        message,
        conversationId,
        requestId: crypto.randomUUID(),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setQuota(result.quota);
        setMessages((current) => [...current, { isCreatedByUser: false, text: result.text }]);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof VisitorApiError && error.quota) setQuota(error.quota);
        setMessages((current) => [
          ...current,
          {
            isCreatedByUser: false,
            text:
              error instanceof VisitorApiError && error.text
                ? error.text
                : localize('com_ui_error'),
          },
        ]);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const content =
    messages.length === 0 ? (
      <VisitorLanding />
    ) : (
      <MinimalMessages>
        <div role="log" aria-live="polite" className="mx-auto w-full max-w-3xl pt-14 xl:max-w-4xl">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`group relative w-full px-5 py-4 ${message.isCreatedByUser ? 'user-turn' : 'assistant-turn'}`}
            >
              <div className="chatone-message-body message-render">
                <Container>
                  {message.isCreatedByUser ? (
                    <div className="whitespace-pre-wrap">{message.text}</div>
                  ) : (
                    <MarkdownLite content={message.text} codeExecution={false} />
                  )}
                </Container>
              </div>
            </div>
          ))}
          {busy && (
            <div role="status" className="px-5 py-4">
              <Spinner />
            </div>
          )}
          <div ref={bottom} />
        </div>
      </MinimalMessages>
    );

  const disabled =
    !conversationId || session.isLoading || createConversation.isPending || (quota?.remaining ?? 0) <= 0;
  const composer = (
    <>
      <div className="chatone-visitor-quota" role="status" aria-live="polite">
        {localize('com_ui_visitor_quota_remaining', {
          0: quota?.remaining ?? '—',
          1: quota?.limit ?? 20,
        })}
      </div>
      <VisitorChatForm
        key={generation}
        busy={busy}
        disabled={disabled}
        onSubmit={submit}
        onStop={stop}
      />
    </>
  );

  return (
    <div
      className={[
        'chatone-visitor-route relative flex h-dvh w-full overflow-hidden bg-presentation',
        embedded ? 'is-embedded' : '',
      ].join(' ')}
      data-testid="visitor-chat-route"
      data-embedded={embedded || undefined}
    >
      <main className="flex h-full w-full flex-col overflow-y-auto">
        <ChatViewFrame
          isLandingPage={messages.length === 0}
          header={<VisitorHeader onReset={reset} />}
          content={content}
          composer={composer}
          footer={<Footer startupConfig={null} />}
        />
      </main>
    </div>
  );
}
