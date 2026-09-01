import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspacePage from '../WorkspacePage';

jest.mock('@librechat/client', () => ({
  useMediaQuery: jest.fn(() => false),
}));

jest.mock('~/components/Chat/Menus/OpenSidebar', () => ({
  __esModule: true,
  default: () => <button type="button" aria-label="open-sidebar" />,
}));

jest.mock('~/hooks', () => ({
  useAuthContext: jest.fn(() => ({ user: { name: 'Jojo', username: 'jojo' } })),
  useLocalize: jest.fn(
    () => (key: string, options?: Record<number, string | number>) =>
      options?.[0] ? `${key}:${options[0]}` : key,
  ),
}));

jest.mock('~/data-provider', () => ({
  useConversationsInfiniteQuery: jest.fn(() => ({
    data: {
      pages: [
        {
          conversations: [
            {
              conversationId: 'conversation-1',
              title: 'Build the workspace',
              updatedAt: '2026-09-01T08:00:00.000Z',
            },
          ],
          nextCursor: null,
        },
      ],
    },
    isLoading: false,
  })),
  useProjectsInfiniteQuery: jest.fn(() => ({
    data: {
      pages: [
        {
          projects: [
            {
              _id: 'project-1',
              name: 'Personal OS',
              description: 'A private operating system',
              conversationCount: 2,
            },
          ],
          nextCursor: null,
        },
      ],
    },
    isLoading: false,
  })),
}));

describe('WorkspacePage', () => {
  it('brings ChatOne work and the public website into one home', () => {
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'com_workspace_welcome:Jojo' })).toBeInTheDocument();
    const manageSite = screen.getByRole('link', { name: /com_workspace_manage_site/ });
    expect(manageSite).toHaveAttribute('href', '/workspace/site');
    expect(screen.getByRole('link', { name: /com_workspace_view_site/ })).toHaveAttribute(
      'href',
      'https://jojoo.cc/',
    );
    expect(screen.getByRole('link', { name: /Build the workspace/ })).toHaveAttribute(
      'href',
      '/c/conversation-1',
    );
    expect(screen.getByRole('link', { name: /Personal OS/ })).toHaveAttribute(
      'href',
      '/projects/project-1',
    );
  });
});
