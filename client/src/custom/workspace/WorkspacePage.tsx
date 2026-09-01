import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMediaQuery } from '@librechat/client';
import {
  ArrowRight,
  BarChart3,
  Bot,
  ExternalLink,
  FolderKanban,
  Globe2,
  MessageSquare,
  PenLine,
  Puzzle,
  Sparkles,
  SquarePen,
} from 'lucide-react';
import { useConversationsInfiniteQuery, useProjectsInfiniteQuery } from '~/data-provider';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { useAuthContext, useLocalize } from '~/hooks';
import './workspace.css';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDate(value?: string | null) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

export default function WorkspacePage() {
  const localize = useLocalize();
  const { user } = useAuthContext();
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { data: conversationData, isLoading: conversationsLoading } = useConversationsInfiniteQuery(
    { sortBy: 'updatedAt', sortDirection: 'desc' },
    { staleTime: 30000, cacheTime: 300000 },
  );
  const { data: projectData, isLoading: projectsLoading } = useProjectsInfiniteQuery(
    { sortBy: 'lastConversationAt', sortDirection: 'desc', limit: 4 },
    { staleTime: 30000, cacheTime: 300000 },
  );

  const conversations = useMemo(
    () => conversationData?.pages.flatMap((page) => page.conversations).slice(0, 6) ?? [],
    [conversationData?.pages],
  );
  const projects = useMemo(
    () => projectData?.pages.flatMap((page) => page.projects).slice(0, 4) ?? [],
    [projectData?.pages],
  );
  const displayName = user?.name || user?.username || localize('com_workspace_owner');

  const quickActions = [
    {
      to: '/c/new',
      icon: SquarePen,
      title: localize('com_workspace_new_chat'),
      description: localize('com_workspace_new_chat_desc'),
    },
    {
      to: '/projects',
      icon: FolderKanban,
      title: localize('com_ui_projects'),
      description: localize('com_workspace_projects_desc'),
    },
    {
      to: '/agents',
      icon: Bot,
      title: localize('com_ui_agents'),
      description: localize('com_workspace_agents_desc'),
    },
    {
      to: '/skills',
      icon: Puzzle,
      title: localize('com_ui_skills'),
      description: localize('com_workspace_skills_desc'),
    },
    {
      to: '/prompts/new',
      icon: PenLine,
      title: localize('com_ui_prompts'),
      description: localize('com_workspace_prompts_desc'),
    },
    {
      to: '/usage',
      icon: BarChart3,
      title: localize('com_usage_nav'),
      description: localize('com_workspace_usage_desc'),
    },
  ];

  return (
    <main className="personal-workspace">
      <div className="personal-workspace-shell">
        <header className="personal-workspace-header">
          <div className="personal-workspace-title-row">
            {isSmallScreen ? <OpenSidebar /> : null}
            <div>
              <p className="personal-workspace-eyebrow">
                <Sparkles aria-hidden="true" />
                {localize('com_workspace_nav')}
              </p>
              <h1>{localize('com_workspace_welcome', { 0: displayName })}</h1>
              <p>{localize('com_workspace_subtitle')}</p>
            </div>
          </div>
        </header>

        <section className="personal-workspace-site" aria-labelledby="personal-site-heading">
          <div className="personal-workspace-site-copy">
            <span className="personal-workspace-site-icon" aria-hidden="true">
              <Globe2 />
            </span>
            <div>
              <p className="personal-workspace-site-kicker">
                {localize('com_workspace_site_domain')}
              </p>
              <h2 id="personal-site-heading">{localize('com_workspace_personal_site')}</h2>
              <p>{localize('com_workspace_personal_site_desc')}</p>
            </div>
          </div>
          <div className="personal-workspace-site-actions">
            <a href="http://127.0.0.1:5174/studio/content/home">
              <PenLine aria-hidden="true" />
              {localize('com_workspace_manage_site')}
            </a>
            <a className="primary" href="https://jojoo.cc/" target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              {localize('com_workspace_view_site')}
            </a>
          </div>
        </section>

        <section aria-labelledby="quick-actions-heading">
          <div className="personal-workspace-section-heading">
            <h2 id="quick-actions-heading">{localize('com_workspace_quick_actions')}</h2>
          </div>
          <div className="personal-workspace-actions">
            {quickActions.map((action) => (
              <Link key={action.to} to={action.to} className="personal-workspace-action">
                <span className="personal-workspace-action-icon" aria-hidden="true">
                  <action.icon />
                </span>
                <span>
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowRight className="personal-workspace-action-arrow" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <div className="personal-workspace-recent-grid">
          <section className="personal-workspace-panel" aria-labelledby="recent-chats-heading">
            <div className="personal-workspace-section-heading">
              <h2 id="recent-chats-heading">{localize('com_workspace_recent_chats')}</h2>
              <Link to="/c/new">{localize('com_workspace_view_all')}</Link>
            </div>
            <div className="personal-workspace-list">
              {conversations.map((conversation) => (
                <Link key={conversation.conversationId} to={`/c/${conversation.conversationId}`}>
                  <span className="personal-workspace-list-icon" aria-hidden="true">
                    <MessageSquare />
                  </span>
                  <span className="personal-workspace-list-copy">
                    <strong>{conversation.title || localize('com_ui_new_chat')}</strong>
                    <small>{formatDate(conversation.updatedAt)}</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              {!conversationsLoading && conversations.length === 0 ? (
                <p className="personal-workspace-empty">{localize('com_workspace_empty_chats')}</p>
              ) : null}
              {conversationsLoading && conversations.length === 0 ? (
                <p className="personal-workspace-empty">{localize('com_ui_loading')}</p>
              ) : null}
            </div>
          </section>

          <section className="personal-workspace-panel" aria-labelledby="recent-projects-heading">
            <div className="personal-workspace-section-heading">
              <h2 id="recent-projects-heading">{localize('com_workspace_recent_projects')}</h2>
              <Link to="/projects">{localize('com_workspace_view_all')}</Link>
            </div>
            <div className="personal-workspace-list">
              {projects.map((project) => (
                <Link key={project._id} to={`/projects/${project._id}`}>
                  <span className="personal-workspace-list-icon" aria-hidden="true">
                    <FolderKanban />
                  </span>
                  <span className="personal-workspace-list-copy">
                    <strong>{project.name}</strong>
                    <small>
                      {project.description ||
                        localize('com_workspace_project_chats', { 0: project.conversationCount })}
                    </small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              ))}
              {!projectsLoading && projects.length === 0 ? (
                <p className="personal-workspace-empty">
                  {localize('com_workspace_empty_projects')}
                </p>
              ) : null}
              {projectsLoading && projects.length === 0 ? (
                <p className="personal-workspace-empty">{localize('com_ui_loading')}</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
