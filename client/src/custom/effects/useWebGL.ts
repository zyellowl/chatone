import { useEffect, useState } from 'react';

let supported: boolean | undefined;

export function useWebGL(enabled = true) {
  const [available, setAvailable] = useState(supported ?? false);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (supported === undefined) {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        supported = gl !== null;
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        supported = false;
      }
    }
    setAvailable(supported);
  }, [enabled]);
  return enabled && available;
}
