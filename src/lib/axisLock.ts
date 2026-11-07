/**
 * iOS-only: while a horizontal scroller (chips, carousels, tab strips) is being dragged
 * sideways, lock every vertical scroller above it so the page doesn't drift up or down.
 */
const isScrollable = (el: HTMLElement, axis: 'x' | 'y') => {
  const cs = getComputedStyle(el);
  if (axis === 'x') {
    return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
  }
  return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
};

export function installAxisLock() {
  if (typeof document === 'undefined') return;

  let startX = 0;
  let startY = 0;
  let inHorizontalScroller = false;
  let decided = false;
  let locked: Array<{ el: HTMLElement; prev: string }> = [];

  const release = () => {
    locked.forEach(({ el, prev }) => {
      el.style.overflowY = prev;
    });
    locked = [];
    inHorizontalScroller = false;
    decided = false;
  };

  document.addEventListener(
    'touchstart',
    (e) => {
      release();
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.body) {
        if (isScrollable(el, 'x')) {
          inHorizontalScroller = true;
          break;
        }
        el = el.parentElement;
      }
    },
    { passive: true, capture: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!inHorizontalScroller || decided) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (Math.max(dx, dy) < 5) return;
      decided = true;
      if (dx <= dy) return;
      let el = e.target as HTMLElement | null;
      while (el && el !== document.documentElement) {
        if (isScrollable(el, 'y')) {
          locked.push({ el, prev: el.style.overflowY });
          el.style.overflowY = 'hidden';
        }
        el = el.parentElement;
      }
    },
    { passive: true, capture: true }
  );

  document.addEventListener('touchend', release, { passive: true, capture: true });
  document.addEventListener('touchcancel', release, { passive: true, capture: true });
}
