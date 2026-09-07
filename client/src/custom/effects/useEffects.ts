import { useEffect, useState } from 'react';
import { useTheme, useMediaQuery } from '@librechat/client';

export function useEffects() {
  const { theme } = useTheme();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const touchDevice = useMediaQuery('(pointer: coarse), (max-width: 767px)');
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  const dark = theme === 'dark' || (theme === 'system' && systemDark);
  return {
    theme: dark ? ('dark' as const) : ('light' as const),
    paused: reducedMotion || !visible,
    touchDevice,
    richEffects: !reducedMotion,
  };
}
