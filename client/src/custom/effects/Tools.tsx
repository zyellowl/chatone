import { Liquid } from 'liquid-gooey';
import type { ReactNode } from 'react';
import { useEffects } from './useEffects';

export default function Tools({ attachment, model }: { attachment: ReactNode; model: ReactNode }) {
  const { richEffects, touchDevice } = useEffects();
  if (!richEffects) {
    return (
      <div className="chatone-liquid-tools chatone-touch-tools">
        <div className="chatone-liquid-attachment">{attachment}</div>
        <div className="personal-composer-model-selector">{model}</div>
      </div>
    );
  }
  return (
    <Liquid
      className="chatone-liquid-tools"
      blur={touchDevice ? 1 : 2}
      contrast={18}
      fill="transparent"
    >
      <Liquid.Item radius={22}>
        <div className="chatone-liquid-attachment">{attachment}</div>
      </Liquid.Item>
      <Liquid.Item radius={22} transition="smooth">
        <div className="personal-composer-model-selector">{model}</div>
      </Liquid.Item>
    </Liquid>
  );
}
