import React from 'react';
import { RecoilRoot } from 'recoil';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VisitorRoute from '../VisitorRoute';

describe('native ChatOne visitor route', () => {
  it('renders native chat controls without querying owner history and resets the conversation', async () => {
    Element.prototype.scrollIntoView = jest.fn();
    const request = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ text: 'Approved public answer' }) });
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
      expect(request).not.toHaveBeenCalled();
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: '介绍一下你自己' } });
      fireEvent.click(screen.getByTestId('send-button'));
      await screen.findByText('Approved public answer');
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(
        '/api/visitor/chat',
        expect.objectContaining({ credentials: 'omit' }),
      );
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

  it('uses a compact shell without a duplicate header when embedded by jojoo.cc', () => {
    const previousUrl = window.location.href;
    window.history.replaceState({}, '', '/visitor/?embed=jojoo&lang=zh-Hans');
    const queryClient = new QueryClient();

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
    expect(container.querySelector('.chatone-visitor-embed-shell')).not.toBeNull();
    expect(container.querySelector('.chatone-visitor-landing')).not.toBeNull();
    expect(container.querySelector('header')).toBeNull();

    queryClient.clear();
    window.history.replaceState({}, '', previousUrl);
  });
});
