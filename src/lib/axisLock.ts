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

/**
 * Short horizontal strips (chips, tab rows, week pickers) are tagged `data-hscroll`;
 * CSS gives them `touch-action: pan-x`, so a gesture that starts on them can only pan
 * sideways and never nudges the page up or down. Tall carousels are left alone.
 */
export function installHorizontalStripTagging() {
  if (typeof document === 'undefined') return;

  const tag = () => {
    document.querySelectorAll<HTMLElement>('[class*="overflow-x-"]').forEach((el) => {
      const cs = getComputedStyle(el);
      const horizontal = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
      const isShort = el.clientHeight > 0 && el.clientHeight <= 160;
      if (horizontal && isShort) {
        if (!el.hasAttribute('data-hscroll')) el.setAttribute('data-hscroll', '');
      } else if (el.hasAttribute('data-hscroll')) {
        el.removeAttribute('data-hscroll');
      }
    });
  };

  let timer: number | undefined;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(tag, 250);
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  schedule();
}
