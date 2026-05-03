import { Modal } from './ui';
import type { ReactNode } from 'react';

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  action,
}: {
  keys: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0">
        {keys}
      </div>
      <div className="text-sm text-muted-foreground">
        {action}
      </div>
    </div>
  );
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const isTouchOnly =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(pointer: coarse)').matches ?? false) &&
    (window.matchMedia?.('(hover: none)').matches ?? false);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" swipeToClose>
      <div
        data-autofocus="true"
        tabIndex={0}
        className="outline-none"
      />

      {isTouchOnly && (
        <p className="text-xs text-muted-foreground mb-5">
          Shortcuts require a physical keyboard (hardware keyboard).
        </p>
      )}

      <div className="space-y-7">
        <div>
          <h3 className="text-sm font-semibold mb-3">Tasks page</h3>
          <div className="space-y-3">
            <ShortcutRow keys={<Kbd>n</Kbd>} action="Open new-task detail sheet" />
            <ShortcutRow
              keys={<Kbd>q</Kbd>}
              action="Toggle inline quick-add bar"
            />
            <ShortcutRow
              keys={<Kbd>/</Kbd>}
              action="Focus the quick-add input"
            />
            <ShortcutRow
              keys={<Kbd>s</Kbd>}
              action="Cycle sort mode"
            />
            <ShortcutRow
              keys={<Kbd>?</Kbd>}
              action="Open this shortcuts reference"
            />
            <div className="h-px bg-border my-2" />
            <ShortcutRow
              keys={<Kbd>1</Kbd>}
              action="Switch to Today view"
            />
            <ShortcutRow
              keys={<Kbd>2</Kbd>}
              action="Switch to This Week view"
            />
            <ShortcutRow
              keys={<Kbd>3</Kbd>}
              action="Switch to Upcoming view"
            />
            <ShortcutRow
              keys={<Kbd>4</Kbd>}
              action="Switch to All Tasks view"
            />
            <div className="h-px bg-border my-2" />
            <ShortcutRow
              keys={<Kbd>Escape</Kbd>}
              action="Close any open sheet / modal"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-3">Global shortcuts</h3>
          <div className="space-y-3">
            <ShortcutRow
              keys={
                <span className="inline-flex items-center gap-1">
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>K</Kbd>
                </span>
              }
              action="Open command palette"
            />
            <ShortcutRow
              keys={
                <span className="inline-flex items-center gap-1">
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>P</Kbd>
                </span>
              }
              action="Open command palette"
            />
            <ShortcutRow
              keys={
                <span className="inline-flex items-center gap-1">
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <Kbd>/</Kbd>
                </span>
              }
              action="Open command palette"
            />
            <ShortcutRow
              keys={<Kbd>Escape</Kbd>}
              action="Close command palette"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

