import { memo } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import type { OrbSize, OrbState } from 'thinking-orbs';
import { useEffects } from './useEffects';

export default memo(function Orb({
  state = 'working',
  size = 20,
  displaySize = size,
}: {
  state?: OrbState;
  size?: OrbSize;
  displaySize?: number;
}) {
  const { theme, paused } = useEffects();
  return (
    <ThinkingOrb
      state={state}
      size={size}
      style={{ width: displaySize, height: displaySize }}
      theme={theme}
      paused={paused}
      data-orb-state={state}
      aria-hidden="true"
    />
  );
});
