import { lazy, memo, Suspense, useCallback, useMemo, useState } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useLocation, useNavigate } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  PanelLeftClose,
  Search,
  SlidersHorizontal,
  SquarePen,
} from 'lucide-react';
import type { NavLink } from '~/common';
import { DEFAULT_PANEL, resolveActivePanel, useActivePanel } from '~/Providers';
import SidePanelNav from '~/components/SidePanel/Nav';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

function ClaudeSidebarShell({ links, onCollapse }: { links: NavLink[]; onCollapse: () => void }) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { active, setActive } = useActivePanel();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const setSearchState = useSetRecoilState(store.search);
  const [showCustomize, setShowCustomize] = useState(false);
  const effectiveActive = resolveActivePanel(active, links);
  const secondaryLinks = useMemo(() => links.filter((link) => link.id !== DEFAULT_PANEL), [links]);

  const startNewChat = useCallback(() => {
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
    setActive(DEFAULT_PANEL);
  }, [conversation?.conversationId, newConversation, queryClient, setActive]);

  const openChats = useCallback(() => {
    setActive(DEFAULT_PANEL);
    navigate('/c/new');
  }, [navigate, setActive]);

  const openWorkspace = useCallback(() => {
    setActive(DEFAULT_PANEL);
    navigate('/workspace');
  }, [navigate, setActive]);

  const openSearch = useCallback(() => {
    setActive(DEFAULT_PANEL);
    setSearchState((previous) => ({ ...previous, isSearching: true }));
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-testid="nav-search-input"]')?.focus();
    });
  }, [setActive, setSearchState]);

  const openProjects = useCallback(() => {
    setActive(DEFAULT_PANEL);
    navigate('/projects');
  }, [navigate, setActive]);

  const openUsage = useCallback(() => {
    setActive(DEFAULT_PANEL);
    navigate('/usage');
  }, [navigate, setActive]);

  return (
    <div className="personal-claude-sidebar flex h-full min-h-0 w-full flex-col bg-surface-primary-alt">
      <div className="personal-claude-sidebar-header">
        <div className="personal-claude-sidebar-brand">
          <span className="personal-claude-mark" aria-hidden="true">
            <img src="/assets/chatone-troll.png" alt="" draggable={false} />
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
        <button type="button" className="personal-claude-new-chat" onClick={startNewChat}>
          <SquarePen aria-hidden="true" />
          <span>{localize('com_ui_new_chat')}</span>
        </button>
        <button
          type="button"
          className={cn('personal-claude-nav-row', location.pathname === '/workspace' && 'active')}
          onClick={openWorkspace}
        >
          <LayoutDashboard aria-hidden="true" />
          <span>{localize('com_workspace_nav')}</span>
        </button>
        <button type="button" className="personal-claude-nav-row" onClick={openSearch}>
          <Search aria-hidden="true" />
          <span>{localize('com_ui_search')}</span>
        </button>
        {secondaryLinks.length > 0 && (
          <>
            <button
              type="button"
              className={cn(
                'personal-claude-nav-row',
                showCustomize || effectiveActive !== DEFAULT_PANEL ? 'active' : '',
              )}
              aria-expanded={showCustomize}
              onClick={() => setShowCustomize((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" />
              <span>{localize('com_nav_customize')}</span>
              <ChevronDown
                className={cn('ml-auto transition-transform', showCustomize && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            {showCustomize && (
              <div className="personal-claude-customize-list">
                {secondaryLinks.map((link) => (
                  <button
                    type="button"
                    key={link.id}
                    className={cn(link.id === effectiveActive && 'active')}
                    onClick={() => {
                      setActive(link.id);
                      setShowCustomize(false);
                    }}
                  >
                    <link.icon aria-hidden="true" />
                    <span>{localize(link.title)}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <button
          type="button"
          className={cn(
            'personal-claude-nav-row',
            effectiveActive === DEFAULT_PANEL && location.pathname.startsWith('/c') && 'active',
          )}
          onClick={openChats}
        >
          <MessageSquare aria-hidden="true" />
          <span>{localize('com_ui_chats')}</span>
        </button>
        <button
          type="button"
          className={cn(
            'personal-claude-nav-row',
            location.pathname.startsWith('/projects') && 'active',
          )}
          onClick={openProjects}
        >
          <FolderKanban aria-hidden="true" />
          <span>{localize('com_ui_projects')}</span>
        </button>
      </div>

      <nav className="personal-claude-sidebar-body" aria-label={localize('com_ui_chat_history')}>
        <SidePanelNav links={links} />
      </nav>

      <div className="personal-claude-sidebar-footer">
        <button
          type="button"
          data-testid="usage-nav-button"
          className={cn('personal-claude-nav-row', location.pathname === '/usage' && 'active')}
          onClick={openUsage}
        >
          <BarChart3 aria-hidden="true" />
          <span>{localize('com_usage_nav')}</span>
        </button>
        <Suspense fallback={<div className="h-12" />}>
          <AccountSettings />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ClaudeSidebarShell);
