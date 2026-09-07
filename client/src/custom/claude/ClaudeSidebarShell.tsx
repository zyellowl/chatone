import { lazy, memo, Suspense, useCallback } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { NavLink as RouterNavLink } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { FolderKanban, PanelLeftClose, Search, SquarePen } from 'lucide-react';
import type { NavLink } from '~/common';
import { DEFAULT_PANEL, useActivePanel } from '~/Providers';
import SidePanelNav from '~/components/SidePanel/Nav';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache } from '~/utils';
import store from '~/store';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

function ClaudeSidebarShell({ links, onCollapse }: { links: NavLink[]; onCollapse: () => void }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { setActive } = useActivePanel();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const setSearchState = useSetRecoilState(store.search);
  const searchEnabled = useRecoilValue(store.search).enabled;

  const startNewChat = useCallback(() => {
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
    setActive(DEFAULT_PANEL);
    if (window.matchMedia('(max-width: 767px)').matches) {
      onCollapse();
    }
  }, [conversation?.conversationId, newConversation, onCollapse, queryClient, setActive]);

  const openSearch = useCallback(() => {
    setActive(DEFAULT_PANEL);
    setSearchState((previous) => ({ ...previous, isSearching: true }));
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-testid="nav-search-input"]')?.focus();
    });
  }, [setActive, setSearchState]);

  return (
    <div className="personal-claude-sidebar flex h-full min-h-0 w-full flex-col bg-surface-primary-alt">
      <div className="personal-claude-sidebar-header">
        <div className="personal-claude-sidebar-brand">
          <span className="personal-claude-mark" aria-hidden="true">
            <img src="/assets/chatone-logo.png?v=feather-20260907" alt="" draggable={false} />
          </span>
          <span>{localize('com_ui_chatone')}</span>
        </div>
        <button
          type="button"
          className="personal-claude-icon-button"
          onClick={onCollapse}
          aria-label={localize('com_nav_close_sidebar')}
        >
          <PanelLeftClose aria-hidden="true" />
        </button>
      </div>

      <div className="personal-claude-sidebar-actions">
        <button
          type="button"
          data-testid="chatone-new-chat"
          className="personal-claude-new-chat"
          onClick={startNewChat}
        >
          <SquarePen aria-hidden="true" />
          <span>{localize('com_ui_new_chat')}</span>
        </button>
        {searchEnabled && (
          <button type="button" className="personal-claude-nav-row" onClick={openSearch}>
            <Search aria-hidden="true" />
            <span>{localize('com_ui_search')}</span>
          </button>
        )}
        <RouterNavLink
          to="/projects"
          className={({ isActive }) =>
            isActive ? 'personal-claude-nav-row active' : 'personal-claude-nav-row'
          }
          onClick={() => {
            setActive(DEFAULT_PANEL);
            if (window.matchMedia('(max-width: 767px)').matches) {
              onCollapse();
            }
          }}
        >
          <FolderKanban aria-hidden="true" />
          <span>{localize('com_ui_projects')}</span>
        </RouterNavLink>
      </div>

      <nav className="personal-claude-sidebar-body" aria-label={localize('com_ui_chat_history')}>
        <SidePanelNav links={links} />
      </nav>

      <div className="personal-claude-sidebar-footer">
        <Suspense fallback={<div className="h-12" />}>
          <AccountSettings />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ClaudeSidebarShell);
