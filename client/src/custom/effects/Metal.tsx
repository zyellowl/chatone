import { MetalFx } from 'metal-fx';
import type { ReactNode } from 'react';
import { useEffects } from './useEffects';
import { useWebGL } from './useWebGL';

export default function Metal({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const { theme, paused, richEffects } = useEffects();
  const available = useWebGL(richEffects && !disabled);
  return (
    <div className="chatone-touch-metal">
      {children}
      {available && (
        <MetalFx
          className="chatone-metal chatone-metal-decoration"
          style={{ width: 46, height: 46 }}
          variant="circle"
          preset="silver"
          theme={theme}
          strength={theme === 'light' ? 0.6 : 0.5}
          ringCssPx={1}
          paused={paused}
          disableGlow={true}
          borderRadius={999}
          normalizeHostStyles={false}
          aria-hidden="true"
        >
          <span className="block size-11 rounded-full" />
        </MetalFx>
      )}
    </div>
  );
}
