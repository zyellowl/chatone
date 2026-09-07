import { useMutation } from '@tanstack/react-query';

type VisitorRequest = { message: string; history: string[]; signal: AbortSignal };
type VisitorResponse = { text: string };

export function useVisitorChatMutation() {
  return useMutation<VisitorResponse, Error, VisitorRequest>(async ({ signal, ...body }) => {
    const response = await fetch('/api/visitor/chat', {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('VISITOR_UNAVAILABLE');
    const data: VisitorResponse = await response.json();
    if (typeof data.text !== 'string') throw new Error('INVALID_VISITOR_RESPONSE');
    return data;
  });
}
