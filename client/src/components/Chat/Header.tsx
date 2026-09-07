import { memo } from 'react';
import { SquarePen } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';
import { useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import { OpenSidebar } from './Menus';
import { TemporaryChat } from './TemporaryChat';
import { useHasAccess } from '~/hooks';

function Header() {
  const hasAccessToTemporaryChat = useHasAccess({
    permissionType: PermissionTypes.TEMPORARY_CHAT,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <header className="personal-claude-header via-presentation/70 md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 absolute top-0 z-10 flex h-[52px] w-full items-center justify-between bg-gradient-to-b from-presentation to-transparent p-2 font-semibold text-text-primary 2xl:via-transparent">
      <div className="mx-1 flex min-w-10 items-center">
        {isSmallScreen ? <OpenSidebar /> : null}
      </div>
      <div className="mx-1 flex min-w-10 items-center justify-end">
        {hasAccessToTemporaryChat === true && <TemporaryChat />}
      </div>
    </header>
  );
}

const MemoizedHeader = memo(Header);
MemoizedHeader.displayName = 'Header';

export default MemoizedHeader;

export function VisitorHeader({ onReset }: { onReset: () => void }) {
  const localize = useLocalize();
  return (
    <header className="personal-claude-header absolute top-0 z-10 flex h-[52px] w-full items-center justify-end p-2 font-semibold text-text-primary">
      <TooltipAnchor
        description={localize('com_ui_new_chat')}
        render={
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-lg hover:bg-surface-hover"
            onClick={onReset}
            aria-label={localize('com_ui_new_chat')}
          >
            <SquarePen size={20} />
          </button>
        }
      />
    </header>
  );
}
