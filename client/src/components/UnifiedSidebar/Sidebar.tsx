import { memo } from 'react';
import type { NavLink } from '~/common';
import ClaudeSidebarShell from '~/custom/claude/ClaudeSidebarShell';
import ClaudeCollapsedSidebar from '~/custom/claude/ClaudeCollapsedSidebar';
import { cn } from '~/utils';

function Sidebar({
  links,
  expanded,
  onCollapse,
  onExpand,
  onResizeStart,
  onResizeKeyboard,
}: {
  links: NavLink[];
  expanded: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onResizeKeyboard: (direction: 'shrink' | 'grow') => void;
}) {
  return (
    <>
      <div className="flex h-full w-full overflow-hidden">
        {expanded ? (
          <ClaudeSidebarShell links={links} onCollapse={onCollapse} />
        ) : (
          <ClaudeCollapsedSidebar onExpand={onExpand} />
        )}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={expanded ? 0 : -1}
        className={cn(
          'absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-border-medium active:bg-border-heavy',
          expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{ transition: expanded ? 'opacity 200ms ease 80ms' : 'opacity 150ms ease' }}
        onMouseDown={onResizeStart}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            onResizeKeyboard('shrink');
          } else if (e.key === 'ArrowRight') {
            onResizeKeyboard('grow');
          }
        }}
      />
    </>
  );
}

export default memo(Sidebar);
