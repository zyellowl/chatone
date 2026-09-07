import { useMutation, useQuery } from '@tanstack/react-query';

export type VisitorQuota = { limit: number; used: number; remaining: number };
export type VisitorSession = {
  scope: 'public_resume_only';
  quota: VisitorQuota;
  model: 'gpt-5.6-sol';
};
export type VisitorResponse = {
  status: 'answered' | 'refused' | 'insufficient' | 'clarify';
  text: string;
  quota: VisitorQuota;
  model: 'gpt-5.6-sol';
  knowledgeVersion: string;
};

export class VisitorApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly text?: string,
    public readonly quota?: VisitorQuota,
  ) {
    super(code);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & {
    error?: string;
    text?: string;
    quota?: VisitorQuota;
  };
  if (!response.ok) {
    throw new VisitorApiError(data.error ?? 'VISITOR_UNAVAILABLE', data.text, data.quota);
  }
  return data;
}

export function useVisitorSessionQuery() {
  return useQuery<VisitorSession>({
    queryKey: ['visitor', 'session'],
    queryFn: async () =>
      parseResponse<VisitorSession>(
        await fetch('/api/visitor/session', { credentials: 'include', cache: 'no-store' }),
      ),
    staleTime: 0,
    retry: 1,
  });
}

export function useCreateVisitorConversationMutation() {
  return useMutation<{ conversationId: string }, Error, void>(async () =>
    parseResponse<{ conversationId: string }>(
      await fetch('/api/visitor/conversations', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ),
  );
}

type VisitorRequest = {
  message: string;
  conversationId: string;
  requestId: string;
  signal: AbortSignal;
};

export function useVisitorChatMutation() {
  return useMutation<VisitorResponse, Error, VisitorRequest>(async ({ signal, ...body }) =>
    parseResponse<VisitorResponse>(
      await fetch('/api/visitor/chat', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ),
  );
}
