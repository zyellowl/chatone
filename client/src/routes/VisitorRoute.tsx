import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@librechat/client';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import Container from '~/components/Chat/Messages/Content/Container';
import MinimalMessages from '~/components/Chat/Messages/MinimalMessages';
import { VisitorChatForm } from '~/components/Chat/Input/ChatForm';
import { useVisitorChatMutation } from '~/data-provider/Visitor';
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
  const request = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const mutation = useVisitorChatMutation();
  useEffect(() => () => request.current?.abort(), []);
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
    setGeneration((value) => value + 1);
  }
  async function submit(message: string) {
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    const history = messages
      .filter((item) => item.isCreatedByUser)
      .slice(-6)
      .map((item) => item.text);
    setMessages((current) => [...current, { isCreatedByUser: true, text: message }].slice(-60));
    setBusy(true);
    try {
      const result = await mutation.mutateAsync({ message, history, signal: controller.signal });
      if (!controller.signal.aborted)
        setMessages((current) => [...current, { isCreatedByUser: false, text: result.text }]);
    } catch {
      if (!controller.signal.aborted)
        setMessages((current) => [
          ...current,
          { isCreatedByUser: false, text: localize('com_ui_error') },
        ]);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const content =
    messages.length === 0 ? (
      <VisitorLanding compact={embedded} />
    ) : (
      <MinimalMessages>
        <div
          role="log"
          aria-live="polite"
          className={
            embedded ? 'chatone-visitor-messages' : 'mx-auto w-full max-w-3xl pt-14 xl:max-w-4xl'
          }
        >
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

  const composer = <VisitorChatForm key={generation} busy={busy} onSubmit={submit} onStop={stop} />;

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
        {embedded ? (
          <div className="chatone-visitor-embed-shell">
            {messages.length > 0 && <VisitorHeader onReset={reset} />}
            <div className="chatone-visitor-embed-content">{content}</div>
            <div className="chatone-visitor-embed-composer">{composer}</div>
          </div>
        ) : (
          <ChatViewFrame
            isLandingPage={messages.length === 0}
            header={<VisitorHeader onReset={reset} />}
            content={content}
            composer={composer}
            footer={<Footer startupConfig={null} />}
          />
        )}
      </main>
    </div>
  );
}
