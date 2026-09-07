import { memo } from 'react';
import Orb from '~/custom/effects/Orb';
import { useLocalize } from '~/hooks';

const EmptyTextPart = memo(() => {
  const localize = useLocalize();
  return (
    <div
      className="chatone-thinking flex min-h-5 items-center gap-2 text-sm text-text-secondary"
      role="status"
    >
      <Orb displaySize={24} />
      <span>{localize('com_ui_thinking')}</span>
    </div>
  );
});

export default EmptyTextPart;
