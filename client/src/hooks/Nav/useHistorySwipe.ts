import { useEffect } from 'react';

export default function useHistorySwipe(
  enabled: boolean,
  expanded: boolean,
  setExpanded: (expanded: boolean) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    let start: { x: number; y: number } | null = null;

    const reset = () => {
      start = null;
    };
    const begin = (event: TouchEvent) => {
      reset();
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          'input, textarea, [contenteditable="true"], [role="slider"], pre, [role="dialog"], [role="menu"]',
        )
      )
        return;
      const touch = event.touches[0];
      if (!expanded && touch.clientX > 40) return;
      if (expanded && !target.closest('[data-testid="mobile-history-panel"]')) return;
      start = { x: touch.clientX, y: touch.clientY };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        reset();
        return;
      }
      const distance = expanded ? -dx : dx;
      if (distance <= 8 || distance <= Math.abs(dy) * 1.5) return;
      if (event.cancelable) event.preventDefault();
      if (distance < 64) return;
      (document.activeElement as HTMLElement | null)?.blur();
      setExpanded(!expanded);
      reset();
    };
    document.addEventListener('touchstart', begin, { passive: true });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', reset);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.removeEventListener('touchstart', begin);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', reset);
      document.removeEventListener('touchcancel', reset);
    };
  }, [enabled, expanded, setExpanded]);
}
