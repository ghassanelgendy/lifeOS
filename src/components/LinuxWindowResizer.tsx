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

const RESIZE_EDGES: EdgeConfig[] = [
  // Corners (take precedence at intersections)
  { dir: 'NorthWest', cursor: 'nwse-resize', style: { top: 0, left: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'NorthEast', cursor: 'nesw-resize', style: { top: 0, right: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'SouthWest', cursor: 'nesw-resize', style: { bottom: 0, left: 0, width: 10, height: 10, zIndex: 100 } },
  { dir: 'SouthEast', cursor: 'nwse-resize', style: { bottom: 0, right: 0, width: 10, height: 10, zIndex: 100 } },
  // Edges
  { dir: 'North', cursor: 'ns-resize', style: { top: 0, left: 10, right: 10, height: 6, zIndex: 99 } },
  { dir: 'South', cursor: 'ns-resize', style: { bottom: 0, left: 10, right: 10, height: 6, zIndex: 99 } },
  { dir: 'West', cursor: 'ew-resize', style: { top: 10, bottom: 10, left: 0, width: 6, zIndex: 99 } },
  { dir: 'East', cursor: 'ew-resize', style: { top: 10, bottom: 10, right: 0, width: 6, zIndex: 99 } },
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
