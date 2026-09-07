import React from 'react';
import { RecoilRoot } from 'recoil';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VisitorRoute from '../VisitorRoute';

describe('native ChatOne visitor route', () => {
  it('renders native chat controls without querying owner history and resets the conversation', async () => {
    Element.prototype.scrollIntoView = jest.fn();
    const request = jest.fn().mockImplementation(async (url: string) => {
      if (url === '/api/visitor/session') {
        return {
          ok: true,
          json: async () => ({
            scope: 'public_resume_only',
            quota: { limit: 20, used: 0, remaining: 20 },
            model: 'gpt-5.6-sol',
          }),
        };
      }
      if (url === '/api/visitor/conversations') {
        return {
          ok: true,
          json: async () => ({ conversationId: 'be093c99-9f4c-4b67-b73a-e6f3d056a740' }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          status: 'answered',
          text: 'Approved public answer',
          quota: { limit: 20, used: 1, remaining: 19 },
          model: 'gpt-5.6-sol',
          knowledgeVersion: 'version-1',
        }),
      };
    });
    const previousFetch = global.fetch;
    global.fetch = request;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    try {
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <RecoilRoot>
            <MemoryRouter>
              <VisitorRoute />
            </MemoryRouter>
          </RecoilRoot>
        </QueryClientProvider>,
      );
      expect(screen.getByTestId('chat-composer')).toBeInTheDocument();
      expect(screen.getByTestId('send-button')).toBeInTheDocument();
      expect(container.querySelector('input[type=file],iframe,aside')).toBeNull();
      await screen.findByText('Public resume Q&A · 20 / 20 remaining');
      await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: '介绍一下你自己' } });
      fireEvent.click(screen.getByTestId('send-button'));
      await screen.findByText('Approved public answer');
      expect(request).toHaveBeenCalledTimes(3);
      expect(request).toHaveBeenLastCalledWith(
        '/api/visitor/chat',
        expect.objectContaining({ credentials: 'include' }),
      );
      expect(JSON.parse(request.mock.calls[2][1].body)).toEqual(
        expect.objectContaining({
          message: '介绍一下你自己',
          conversationId: 'be093c99-9f4c-4b67-b73a-e6f3d056a740',
          requestId: expect.any(String),
        }),
      );
      expect(request.mock.calls[2][1].body).not.toContain('history');
      expect(await screen.findByText('Public resume Q&A · 19 / 20 remaining')).toBeInTheDocument();
      const reset = container.querySelector('header button');
      expect(reset).not.toBeNull();
      fireEvent.click(reset!);
      await waitFor(() =>
        expect(screen.queryByText('Approved public answer')).not.toBeInTheDocument(),
      );
    } finally {
      global.fetch = previousFetch;
      queryClient.clear();
    }
  });

  it('uses the main ChatOne layout without a history sidebar when embedded by jojoo.cc', () => {
    const previousUrl = window.location.href;
    window.history.replaceState({}, '', '/visitor/?embed=jojoo&lang=zh-Hans');
    const queryClient = new QueryClient();
    const previousFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scope: 'public_resume_only',
        quota: { limit: 20, used: 20, remaining: 0 },
        model: 'gpt-5.6-sol',
      }),
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <RecoilRoot>
          <MemoryRouter>
            <VisitorRoute />
          </MemoryRouter>
        </RecoilRoot>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('visitor-chat-route')).toHaveAttribute('data-embedded', 'true');
    expect(screen.getByTestId('visitor-chat-route')).toHaveClass('is-embedded');
    expect(container.querySelector('.personal-claude-chat')).not.toBeNull();
    expect(container.querySelector('.personal-claude-landing')).not.toBeNull();
    expect(container.querySelector('.personal-claude-composer-wrap')).not.toBeNull();
    expect(container.querySelector('header button')).not.toBeNull();
    expect(container.querySelector('aside, nav')).toBeNull();

    queryClient.clear();
    global.fetch = previousFetch;
    window.history.replaceState({}, '', previousUrl);
  });
});
