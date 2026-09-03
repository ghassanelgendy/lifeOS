import { useEffect, useRef, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';

type ButtonToken = 'close' | 'minimize' | 'maximize';

const DEFAULT_LAYOUT = 'menu:minimize,maximize,close';

function parseLayout(raw: string): { left: ButtonToken[]; right: ButtonToken[] } {
  const isButton = (t: string): t is ButtonToken =>
    t === 'close' || t === 'minimize' || t === 'maximize';
  const [leftRaw = '', rightRaw = ''] = raw.split(':');
  return {
    left: leftRaw.split(',').filter(isButton),
    right: rightRaw.split(',').filter(isButton),
  };
}

/**
 * Native GNOME window decorations for this app turned out to not be reliably
 * clickable (the min/maximize/close buttons didn't respond), independent of
 * whether they were even shown in the right position — so the Linux build
 * hides native decorations entirely (--hide-window-decorations) and this
 * in-page bar is the only way to minimize/maximize/close. It mirrors the
 * order/side the user configured via GNOME's `button-layout` gsetting rather
 * than hard-coding a right-aligned Windows/macOS style, and keeps following
 * it live if that setting changes while the app is running (the Rust side
 * watches it via `gsettings monitor` and emits `gnome-button-layout-changed`).
 * Only visible under `.linux-platform` (see index.web.css); stays mounted
 * otherwise so its hooks don't need to re-run on a platform switch.
 */
export function LinuxTitleBar() {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [isMaximized, setIsMaximized] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const tauri = (window as any).__TAURI__;
    if (!tauri?.core?.invoke) return;

    let cancelled = false;
    tauri.core
      .invoke('get_gnome_button_layout')
      .then((value: string) => {
        if (!cancelled && value) setLayout(value);
      })
      .catch(() => {});

    tauri.event
      ?.listen('gnome-button-layout-changed', (event: { payload: string }) => {
        if (event.payload) setLayout(event.payload);
      })
      .then((unlisten: () => void) => {
        unlistenRef.current = unlisten;
      })
      .catch(() => {});

    const win = tauri.window?.getCurrentWindow?.();
    win?.isMaximized?.().then((v: boolean) => setIsMaximized(v)).catch(() => {});
    win
      ?.onResized?.(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      })
      .then((unlisten: () => void) => {
        const prevUnlisten = unlistenRef.current;
        unlistenRef.current = () => {
          prevUnlisten?.();
          unlisten();
        };
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlistenRef.current?.();
    };
  }, []);

  const getWindow = () => (window as any).__TAURI__?.window?.getCurrentWindow?.();

  const { left, right } = parseLayout(layout);

  const renderButton = (token: ButtonToken, key: string) => {
    switch (token) {
      case 'minimize':
        return (
          <button
            key={key}
            type="button"
            aria-label="Minimize"
            className="linux-titlebar-btn"
            onClick={() => getWindow()?.minimize()}
          >
            <Minus size={14} />
          </button>
        );
      case 'maximize':
        return (
          <button
            key={key}
            type="button"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            className="linux-titlebar-btn"
            onClick={() => getWindow()?.toggleMaximize()}
          >
            {isMaximized ? <Copy size={12} /> : <Square size={12} />}
          </button>
        );
      case 'close':
        return (
          <button
            key={key}
            type="button"
            aria-label="Close"
            className="linux-titlebar-btn linux-titlebar-btn-close"
            onClick={() => getWindow()?.close()}
          >
            <X size={14} />
          </button>
        );
    }
  };

  return (
    <div className="linux-titlebar" data-tauri-drag-region>
      <div className="linux-titlebar-side" data-tauri-drag-region>
        {left.map((t, i) => renderButton(t, `l-${i}`))}
      </div>
      <div className="linux-titlebar-spacer" data-tauri-drag-region />
      <div className="linux-titlebar-side" data-tauri-drag-region>
        {right.map((t, i) => renderButton(t, `r-${i}`))}
      </div>
    </div>
  );
}
