import { BorderBeam } from 'border-beam';
import type { CSSProperties, ReactNode } from 'react';
import { useEffects } from './useEffects';

export default function Beam({ children, engaged }: { children: ReactNode; engaged: boolean }) {
  const { theme, paused, richEffects } = useEffects();
  return (
    <BorderBeam
      className="chatone-beam"
      size="md"
      colorVariant="colorful"
      strength={engaged ? 0.7 : 0.35}
      duration={4.6}
      borderRadius={21.6}
      active={richEffects && !paused}
      theme={theme}
      brightness={1.6}
      style={{ '--beam-stroke-opacity': 2, '--beam-inner-opacity': 1.2 } as CSSProperties}
    >
      {children}
    </BorderBeam>
  );
}
