import { ImageGeneration } from 'img-fx';
import type { CSSProperties } from 'react';
import { useEffects } from './useEffects';
import { useWebGL } from './useWebGL';

export default function GeneratingImage({ width, height }: { width: string; height: string }) {
  const { theme, paused, richEffects } = useEffects();
  const available = useWebGL(richEffects);
  const style: CSSProperties = { width, height, maxWidth: '100%', borderRadius: 16 };
  const fallback = <div className="chatone-image-placeholder" style={style} aria-hidden="true" />;
  if (!available) {
    return fallback;
  }
  return (
    <ImageGeneration
      className="chatone-image-generation"
      style={style}
      preset="pixels-organic"
      theme={theme}
      paused={paused}
      autoReveal={false}
      aria-hidden="true"
    >
      {fallback}
    </ImageGeneration>
  );
}
