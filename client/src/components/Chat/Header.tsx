import { SquarePen } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme, useMediaQuery } from '@librechat/client';
import { OpenSidebar } from './Menus';
import { useLocalize } from '~/hooks';

function Header() {
  const localize = useLocalize();
  const { theme, setTheme } = useTheme();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const dark = theme === 'dark' || (theme === 'system' && systemDark);

  const isSmallScreen = useMediaQuery('(max-width: 768px)');

  return (
    <header className="personal-claude-header via-presentation/70 md:from-presentation/80 md:via-presentation/50 2xl:from-presentation/0 absolute top-0 z-10 flex h-[52px] w-full items-center justify-between bg-gradient-to-b from-presentation to-transparent p-2 font-semibold text-text-primary 2xl:via-transparent">
      <div className="mx-1 flex min-w-10 items-center">
        {isSmallScreen ? <OpenSidebar /> : null}
      </div>
      <div className="mx-1 flex min-w-10 items-center justify-end gap-2">
        <button
          type="button"
          data-testid="theme-toggle-button"
          aria-label={localize('com_ui_toggle_theme')}
          aria-pressed={dark}
          title={localize('com_ui_toggle_theme')}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </button>
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
