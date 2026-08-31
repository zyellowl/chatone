import { lazy, memo, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, PanelLeftOpen, SquarePen } from 'lucide-react';
import { useLocalize } from '~/hooks';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

function ClaudeCollapsedSidebar({ onExpand }: { onExpand: () => void }) {
  const localize = useLocalize();

  return (
    <div className="personal-claude-collapsed flex h-full w-full flex-col items-center bg-surface-primary-alt py-3">
      <button
        type="button"
        className="personal-claude-icon-button"
        onClick={onExpand}
        aria-label={localize('com_nav_open_sidebar')}
      >
        <PanelLeftOpen aria-hidden="true" />
      </button>
      <Link
        to="/c/new"
        className="personal-claude-icon-button mt-2"
        aria-label={localize('com_ui_new_chat')}
      >
        <SquarePen aria-hidden="true" />
      </Link>
      <button
        type="button"
        className="personal-claude-icon-button mt-1"
        onClick={onExpand}
        aria-label={localize('com_ui_chat_history')}
      >
        <MessageSquare aria-hidden="true" />
      </button>
      <div className="mt-auto">
        <Suspense fallback={<div className="size-9" />}>
          <AccountSettings collapsed />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ClaudeCollapsedSidebar);
