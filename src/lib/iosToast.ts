/**
 * iOS-only: replaces window.alert (a native "capacitor://localhost" dialog in WKWebView)
 * with a small bottom banner that clears the floating tab bar.
 */
let timer: number | undefined;

function showToast(message: unknown) {
  if (typeof document === 'undefined') return;
  const text = String(message ?? '').trim();
  if (!text) return;

  let el = document.getElementById('ios-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ios-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    Object.assign(el.style, {
      position: 'fixed',
      left: '16px',
      right: '16px',
      bottom: 'calc(100px + env(safe-area-inset-bottom))',
      zIndex: '100000',
      margin: '0 auto',
      maxWidth: '440px',
      padding: '12px 16px',
      borderRadius: '16px',
      background: 'var(--color-popover)',
      color: 'var(--color-foreground)',
      fontSize: '15px',
      lineHeight: '20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    } as Partial<CSSStyleDeclaration>);
    el.addEventListener('click', () => {
      if (el) el.style.opacity = '0';
    });
    document.body.appendChild(el);
  }

  el.textContent = text;
  el.style.pointerEvents = 'auto';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.pointerEvents = 'none';
  }, 4000);
}

export function installIosToast() {
  if (typeof window === 'undefined') return;
  window.alert = showToast;
}
