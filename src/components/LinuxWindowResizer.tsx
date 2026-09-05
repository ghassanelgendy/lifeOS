import { useEffect, useState } from 'react';

type ResizeDirection =
  | 'East'
  | 'North'
  | 'NorthEast'
  | 'NorthWest'
  | 'South'
  | 'SouthEast'
  | 'SouthWest'
  | 'West';

interface EdgeConfig {
  dir: ResizeDirection;
  cursor: string;
  style: React.CSSProperties;
}

// The custom Linux title bar (see LinuxTitleBar.tsx) is 32px tall and hosts the
// minimize/maximize/close buttons, which can sit in either top corner depending on
// the user's GNOME button-layout gsetting. Any resize hit-box that overlaps that strip
// steals clicks meant for those buttons (they're both `position: fixed` overlays, so
// z-index alone can't reliably favor the button over the resizer at the same point) — so
// the top corners/edge start below the title bar instead of at the literal window edge.
const TITLE_BAR_HEIGHT = 32;

const RESIZE_EDGES: EdgeConfig[] = [
  // Corners (take precedence at intersections)
  { dir: 'NorthWest', cursor: 'nwse-resize', style: { top: TITLE_BAR_HEIGHT, left: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'NorthEast', cursor: 'nesw-resize', style: { top: TITLE_BAR_HEIGHT, right: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'SouthWest', cursor: 'nesw-resize', style: { bottom: 0, left: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'SouthEast', cursor: 'nwse-resize', style: { bottom: 0, right: 0, width: 10, height: 10, zIndex: 100 } },
  // Edges
  { dir: 'South', cursor: 'ns-resize', style: { bottom: 0, left: 10, right: 10, height: 6, zIndex: 99 } },
  { dir: 'West', cursor: 'ew-resize', style: { top: TITLE_BAR_HEIGHT + 10, bottom: 10, left: 0, width: 6, zIndex: 99 } },
  { dir: 'East', cursor: 'ew-resize', style: { top: TITLE_BAR_HEIGHT + 10, bottom: 10, right: 0, width: 6, zIndex: 99 } },
];

/**
 * On Linux, borderless / undecorated windows (--hide-window-decorations) don't have
 * native WM resize borders. This component mounts 8 invisible edge handles around
 * the window boundaries that invoke Tauri's `startResizeDragging` API on pointerdown.
 * When maximized, resizing is disabled.
 */
export function LinuxWindowResizer() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const tauri = (window as any).__TAURI__;
    const win = tauri?.window?.getCurrentWindow?.();
    if (!win) return;

    let cancelled = false;
    win.isMaximized?.().then((max: boolean) => {
      if (!cancelled) setIsMaximized(max);
    }).catch(() => {});

    let unlisten: (() => void) | undefined;
    win.onResized?.(() => {
      win.isMaximized?.().then((max: boolean) => {
        if (!cancelled) setIsMaximized(max);
      }).catch(() => {});
    }).then((fn: () => void) => {
      unlisten = fn;
    }).catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // When maximized, disable edge resize handles
  if (isMaximized) return null;

  const handlePointerDown = (dir: ResizeDirection, e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only main left click
    e.preventDefault();
    e.stopPropagation();

    const tauri = (window as any).__TAURI__;
    const win = tauri?.window?.getCurrentWindow?.();

    if (win?.startResizeDragging) {
      win.startResizeDragging(dir).catch(() => {});
    } else if (tauri?.core?.invoke) {
      tauri.core.invoke('plugin:window|start_resize_dragging', {
        label: win?.label || 'pake',
        value: dir,
      }).catch(() => {});
    }
  };

  return (
    <div className="linux-window-resizers pointer-events-none fixed inset-0 z-[9999] select-none">
      {RESIZE_EDGES.map((edge) => (
        <div
          key={edge.dir}
          aria-hidden="true"
          onPointerDown={(e) => handlePointerDown(edge.dir, e)}
          style={{
            position: 'absolute',
            pointerEvents: 'auto',
            cursor: edge.cursor,
            ...edge.style,
          }}
        />
      ))}
    </div>
  );
}
