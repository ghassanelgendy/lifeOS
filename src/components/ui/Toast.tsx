import { create } from 'zustand';
import { cn } from './cn';

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  tone: 'neutral' | 'error';
}

interface ToastState {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'tone'> & { tone?: ToastItem['tone']; durationMs?: number }) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ durationMs, tone = 'neutral', ...t }) => {
    const id = nextId++;
    // Cap at 3 visible; oldest drops first.
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id, tone }] }));
    // Errors stay longer; undo toasts need time to be noticed (6s).
    window.setTimeout(() => get().dismiss(id), durationMs ?? (tone === 'error' ? 8000 : 6000));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helpers. Prefer `undoable` over a confirm dialog for reversible actions. */
export const toast = {
  show: (message: string) => useToastStore.getState().push({ message }),
  error: (message: string) => useToastStore.getState().push({ message, tone: 'error' }),
  /** Run the action now; offer Undo. `undo` must fully restore the previous state. */
  undoable: (message: string, undo: () => void) =>
    useToastStore.getState().push({ message, actionLabel: 'Undo', onAction: undo }),
};

/** Mount once in the app shell. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'ds-enter pointer-events-auto flex min-h-11 max-w-md items-center gap-3 rounded-control border border-separator bg-raised py-1 ps-4 pe-1 text-label shadow-overlay',
            t.tone === 'error' ? 'text-danger' : 'text-ink'
          )}
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              type="button"
              data-ds
              className="ds-t min-h-11 rounded-control px-3 font-semibold text-accent-ds hover:bg-hover"
              onClick={() => { t.onAction?.(); dismiss(t.id); }}
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
